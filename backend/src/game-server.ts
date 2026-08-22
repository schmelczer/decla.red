import { PhysicalContainer } from './physics/containers/physical-container';
import { Server, Socket } from 'socket.io';
import {
  TransportEvents,
  deserialize,
  settings,
  ServerInformation,
  PlayerInformation,
  UpdateGameState,
  CharacterTeam,
  GameEndCommand,
  GameStartCommand,
  Command,
  CommandReceiver,
  CommandExecutors,
  ServerAnnouncement,
  JoinRejectionReason,
  beginPropertyUpdateGeneration,
} from 'shared';
import { createWorld } from './create-world';
import { Options } from './options';
import { PlayerContainer } from './players/player-container';
import { ServerFullError } from './players/server-full-error';
import { Player } from './players/player';
import { StepCommand, GeneratePointsCommand, AnnounceCommand } from './commands/commands';

const gameStateSubscribedRoom = 'gameStateSubscribedRoom';

export class GameServer extends CommandReceiver {
  private objects!: PhysicalContainer;
  private players!: PlayerContainer;
  private lastPhysicsBase: [number, number] = process.hrtime();

  private bluePoints = 0;
  private redPoints = 0;
  private matchPointAnnounced: Partial<Record<CharacterTeam, boolean>> = {};

  private isInEndGame = false;
  private timeScaling = 1;
  private statReportMs = Date.now();

  private initialize() {
    const previousPlayers = this.players;
    this.releaseJoinedSockets();
    this.objects = new PhysicalContainer();
    createWorld(this.objects);
    this.objects.initialize();
    this.players = new PlayerContainer(
      this.objects,
      this.options.playerLimit,
      this.options.npcCount,
    );
    this.lastPhysicsBase = process.hrtime();
    this.bluePoints = 0;
    this.redPoints = 0;
    this.matchPointAnnounced = {};
    this.isInEndGame = false;
    this.timeScaling = 1;
    previousPlayers?.queueCommandForEachClient(new GameStartCommand());
    previousPlayers?.sendQueuedCommands();
  }

  protected commandExecutors: CommandExecutors = {
    [GeneratePointsCommand.type]: this.addPoints.bind(this),
    [AnnounceCommand.type]: ({ text }: AnnounceCommand) =>
      this.players.queueCommandForEachClient(new ServerAnnouncement(text)),
  };

  constructor(
    private readonly io: Server,
    private options: Options,
  ) {
    super();

    this.initialize();

    io.on('connection', (socket: Socket) => {
      socket.on(TransportEvents.PlayerJoining, (playerInfo: PlayerInformation) =>
        this.handleJoin(socket, playerInfo),
      );

      socket.on(TransportEvents.SubscribeForServerInfoUpdates, () => {
        socket.join(gameStateSubscribedRoom);
      });
    });
  }

  private readonly joinedSockets = new Map<Socket, Player>();

  private handleJoin(socket: Socket, playerInfo: PlayerInformation) {
    if (this.joinedSockets.has(socket)) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.AlreadyJoined);
      return;
    }

    if (this.isInEndGame) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.RoundEnding);
      return;
    }

    if (this.players.isFull) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.ServerFull);
      return;
    }

    let player: Player;
    try {
      player = this.players.createPlayer(playerInfo, socket);
    } catch (e) {
      console.error('Failed to register joining player', e);
      socket.emit(
        TransportEvents.JoinRejected,
        e instanceof ServerFullError
          ? JoinRejectionReason.ServerFull
          : JoinRejectionReason.InvalidRequest,
      );
      socket.disconnect();
      return;
    }

    const onPlayerToServer = (json: string) => {
      try {
        if (json.length > settings.maxInboundMessageBytes) {
          return;
        }
        if (!this.allowInboundMessage(socket)) {
          return;
        }
        const commands: Array<Command> = deserialize(json);
        commands.forEach((c) => player.handleCommand(c));
      } catch (e) {
        console.error('Error while processing command', e);
      }
    };

    const onDisconnect = () => {
      const p = this.joinedSockets.get(socket);
      this.joinedSockets.delete(socket);
      this.inboundBudget.delete(socket);
      if (!p) {
        return;
      }
      p.detachFromSocket();
      const { kills, deaths } = player.scoreSnapshot;
      this.players.reserveScore(
        player.reconnectToken,
        player.team,
        kills,
        deaths,
        Date.now(),
      );
      player.destroy();
      this.players.deletePlayer(player);
      this.sendServerStateUpdate();
    };

    socket.on(TransportEvents.PlayerToServer, onPlayerToServer);
    socket.on('disconnect', onDisconnect);
    this.joinedSockets.set(socket, player);

    player.reconnectToken = this.players.issueToken();
    socket.emit(TransportEvents.PlayerJoined, player.reconnectToken);

    this.sendServerStateUpdate();
  }

  private readonly inboundBudget = new Map<Socket, { tokens: number; lastMs: number }>();
  private droppedInboundMessages = 0;
  private allowInboundMessage(socket: Socket): boolean {
    const nowMs = Date.now();
    const burst = settings.maxInboundMessageBurst;
    const perSecond = settings.maxInboundMessagesPerSecond;

    const budget = this.inboundBudget.get(socket) ?? { tokens: burst, lastMs: nowMs };
    budget.tokens = Math.min(
      burst,
      budget.tokens + ((nowMs - budget.lastMs) / 1000) * perSecond,
    );
    budget.lastMs = nowMs;
    this.inboundBudget.set(socket, budget);

    if (budget.tokens < 1) {
      this.droppedInboundMessages++;
      return false;
    }

    budget.tokens -= 1;
    return true;
  }

  private releaseJoinedSockets() {
    for (const [socket, player] of this.joinedSockets) {
      socket.removeAllListeners();
      player.detachFromSocket();
    }
    this.joinedSockets.clear();
    this.inboundBudget.clear();
  }

  private timeSinceLastServerStateUpdate = 0;
  public sendServerStateUpdate() {
    this.io
      .to(gameStateSubscribedRoom)
      .emit(TransportEvents.ServerInfoUpdate, [
        this.players.count,
        (Math.max(this.bluePoints, this.redPoints) / this.options.scoreLimit) * 100,
      ]);
  }

  public start() {
    this.handlePhysics();
  }

  private addPoints({ blue, red }: GeneratePointsCommand) {
    if (this.isInEndGame) {
      return;
    }

    this.bluePoints += blue;
    this.redPoints += red;
    if (this.bluePoints >= this.options.scoreLimit) {
      this.endGame(CharacterTeam.blue);
    } else if (this.redPoints >= this.options.scoreLimit) {
      this.endGame(CharacterTeam.red);
    } else {
      this.announceMatchPointOnce(CharacterTeam.blue, this.bluePoints);
      this.announceMatchPointOnce(CharacterTeam.red, this.redPoints);
    }
  }

  private announceMatchPointOnce(team: CharacterTeam, points: number) {
    if (
      !this.matchPointAnnounced[team] &&
      points >= this.options.scoreLimit * settings.matchPointScoreRatio
    ) {
      this.matchPointAnnounced[team] = true;
      this.players.queueCommandForEachClient(
        new ServerAnnouncement(
          `Match point — team <span class="${team}">${team}</span>!`,
        ),
      );
    }
  }

  private endGame(winningTeam: CharacterTeam) {
    this.isInEndGame = true;
    const endTitleLength = 6;
    this.players.endGame(winningTeam);
    this.players.queueCommandForEachClient(new GameEndCommand());
    setTimeout(() => this.initialize(), endTitleLength * 1000 * 1.1);
  }

  private timeSinceLastPointUpdate = 0;
  private physicsAccumulator = 0;
  private saturatedFrames = 0;

  private handlePhysics() {
    const now = process.hrtime(this.lastPhysicsBase);
    const delta = now[0] + now[1] / 1e9;
    this.lastPhysicsBase = process.hrtime();

    if (Date.now() - this.statReportMs > 30000) {
      this.statReportMs = Date.now();
      const mem = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`;
      console.info(`Memory: ${mem}, Players: ${this.players.count}`);

      if (this.droppedInboundMessages > 0) {
        console.warn(`Rate limited ${this.droppedInboundMessages} inbound msg(s)`);
        this.droppedInboundMessages = 0;
      }
      if (this.saturatedFrames > 0) {
        console.warn(`Physics saturated on ${this.saturatedFrames} frame(s)`);
        this.saturatedFrames = 0;
      }
    }

    if ((this.timeSinceLastServerStateUpdate += delta) > 4) {
      this.timeSinceLastServerStateUpdate = 0;
      this.sendServerStateUpdate();
    }

    if ((this.timeSinceLastPointUpdate += delta) > 0.5) {
      this.timeSinceLastPointUpdate = 0;
      this.players.queueCommandForEachClient(
        new UpdateGameState(this.bluePoints, this.redPoints, this.options.scoreLimit),
      );
    }

    const fixedDelta = settings.targetPhysicsDeltaTimeInSeconds;
    const maxSubstepsPerFrame = 5;
    const maxBacklogSeconds = 0.25;

    this.physicsAccumulator += delta;
    let substeps = Math.floor(this.physicsAccumulator / fixedDelta);
    if (substeps > maxSubstepsPerFrame) {
      this.saturatedFrames++;
      this.physicsAccumulator = Math.min(
        this.physicsAccumulator - maxSubstepsPerFrame * fixedDelta,
        maxBacklogSeconds,
      );
      substeps = maxSubstepsPerFrame;
    } else {
      this.physicsAccumulator -= substeps * fixedDelta;
    }

    for (let i = 0; i < substeps; i++) {
      let scaledDelta = fixedDelta;
      if (this.isInEndGame) {
        this.timeScaling *= Math.pow(settings.endGameDeltaScaling, fixedDelta);
        scaledDelta /= this.timeScaling;
      }
      this.objects.handleCommand(new StepCommand(scaledDelta, this));
      this.players.step(scaledDelta);
    }

    beginPropertyUpdateGeneration();
    this.players.stepCommunication(delta);
    this.objects.resetRemoteCalls();

    const elapsed = process.hrtime(now);
    const physicsDelta = elapsed[0] + elapsed[1] / 1e9;

    setTimeout(
      this.handlePhysics.bind(this),
      Math.max(0, fixedDelta - physicsDelta) * 1000,
    );
  }

  public get serverInfo(): ServerInformation {
    return {
      serverName: this.options.name,
      playerCount: this.players.count,
      playerLimit: this.options.playerLimit,
      gameStatePercent:
        (Math.max(this.bluePoints, this.redPoints) / this.options.scoreLimit) * 100,
    };
  }
}
