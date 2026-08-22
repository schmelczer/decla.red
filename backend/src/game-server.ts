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
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { Options } from './options';
import { PlayerContainer } from './players/player-container';
import { ServerFullError } from './players/server-full-error';
import { Player } from './players/player';
import { StepCommand } from './commands/step';
import { GeneratePointsCommand } from './commands/generate-points';
import { AnnounceCommand } from './commands/announce';

const gameStateSubscribedRoom = 'gameStateSubscribedRoom';

interface JoinedSocket {
  player: Player;
  onPlayerToServer: (json: string) => void;
  onDisconnect: () => void;
}

export class GameServer extends CommandReceiver {
  private objects!: PhysicalContainer;
  private players!: PlayerContainer;
  private deltaTimes!: Array<number>;
  private deltaTimeCalculator!: DeltaTimeCalculator;

  private bluePoints = 0;
  private redPoints = 0;
  private matchPointAnnounced: Partial<Record<CharacterTeam, boolean>> = {};

  private isInEndGame = false;
  private timeScaling = 1;

  private serverName: string;
  private playerLimit: number;

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
    this.deltaTimeCalculator = new DeltaTimeCalculator();
    this.deltaTimes = [];
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

    this.serverName = options.name;
    this.playerLimit = options.playerLimit;

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

  private readonly joinedSockets = new Map<Socket, JoinedSocket>();

  private handleJoin(socket: Socket, playerInfo: PlayerInformation) {
    if (this.joinedSockets.has(socket)) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.AlreadyJoined);
      return;
    }

    if (this.isInEndGame) {
      // The round is already over and the world is about to be rebuilt; joining
      // now drops the player into an arena running in slow motion with no
      // end-of-round card.
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
        if (typeof json !== 'string' || json.length > settings.maxInboundMessageBytes) {
          return;
        }
        if (!this.allowInboundMessage(socket)) {
          return;
        }
        const commands: Array<Command> = deserialize(json);
        if (!Array.isArray(commands)) {
          return;
        }
        commands.forEach((c) => player.handleCommand(c));
      } catch (e) {
        console.error('Error while processing command', e);
      }
    };

    const onDisconnect = () => {
      const record = this.joinedSockets.get(socket);
      this.joinedSockets.delete(socket);
      // The bucket is keyed by the Socket object, so leaving the entry behind
      // pins the socket for the rest of the round.
      this.inboundBudget.delete(socket);
      if (!record) {
        return;
      }
      record.player.detachFromSocket();
      const { kills, deaths } = player.scoreSnapshot;
      // Hold the score briefly so a client whose transport blipped can rejoin as
      // itself rather than as a blank slate.
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
    this.joinedSockets.set(socket, { player, onPlayerToServer, onDisconnect });

    player.reconnectToken = this.players.issueToken();
    socket.emit(TransportEvents.PlayerJoined, player.reconnectToken);

    this.sendServerStateUpdate();
  }

  // Cheap per-socket token bucket, sized well above what a legitimate client
  // produces so it only ever trips on a flood.
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

  // Detach the per-join listeners of every socket still attached to the round
  // that is ending, so a client that survives the restart can join the new one.
  private releaseJoinedSockets() {
    for (const [socket, record] of this.joinedSockets) {
      socket.off(TransportEvents.PlayerToServer, record.onPlayerToServer);
      socket.off('disconnect', record.onDisconnect);
      record.player.detachFromSocket();
    }
    this.joinedSockets.clear();
    this.inboundBudget.clear();
  }

  private timeSinceLastServerStateUpdate = 0;
  public sendServerStateUpdate() {
    this.io
      .to(gameStateSubscribedRoom)
      .emit(TransportEvents.ServerInfoUpdate, [this.players.count, this.gameProgress]);
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
    this.players.queueCommandForEachClient(
      new GameEndCommand(winningTeam, endTitleLength, true),
    );
    setTimeout(() => this.destroy(), endTitleLength * 1000 * 1.1);
  }

  private destroy() {
    this.initialize();
  }

  private timeSinceLastPointUpdate = 0;
  private physicsAccumulator = 0;
  // Frames since the last stats report where physics ran over budget (more
  // substeps than the cap). Surfaced by handleStats as a saturation signal.
  private saturatedFrames = 0;

  private handlePhysics() {
    const delta = this.deltaTimeCalculator.getNextDeltaTimeInSeconds({ setAsBase: true });
    this.deltaTimes.push(delta);

    this.handleStats();

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
    // Cap on retained physics backlog when saturated, so a long stall can't
    // accumulate an unrecoverable catch-up.
    const maxBacklogSeconds = 0.25;

    this.physicsAccumulator += delta;
    let substeps = Math.floor(this.physicsAccumulator / fixedDelta);
    if (substeps > maxSubstepsPerFrame) {
      // Saturated: run the cap's worth of substeps but KEEP the remaining
      // backlog (clamped) instead of zeroing it. Dropping it silently slowed
      // simulated time for everyone — and diverged client prediction, whose
      // wall-clock keeps running. Clamping bounds the catch-up so a transient
      // spike recovers without a death spiral.
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

    const physicsDelta = this.deltaTimeCalculator.getNextDeltaTimeInSeconds();

    setTimeout(
      this.handlePhysics.bind(this),
      Math.max(0, fixedDelta - physicsDelta) * 1000,
    );
  }

  private handleStats() {
    const framesBetweenDeltaTimeCalculation = 10000;

    if (this.deltaTimes.length > framesBetweenDeltaTimeCalculation) {
      this.deltaTimes.sort((a, b) => a - b);
      console.info(
        `Median physics time: ${(
          this.deltaTimes[Math.floor(framesBetweenDeltaTimeCalculation / 2)] * 1000
        ).toFixed(2)} ms`,
      );
      console.info(
        'Tail times: ',
        this.deltaTimes.slice(-20).map((v) => `${(v * 1000).toFixed(2)} ms`),
      );
      console.info(
        `Memory used: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      );

      const rtts = this.players.connectedPlayerRttsMs.filter((r) => r > 0);
      if (rtts.length > 0) {
        rtts.sort((a, b) => a - b);
        console.info(
          `Player RTT median ${rtts[Math.floor(rtts.length / 2)].toFixed(0)} ms ` +
          `(min ${rtts[0].toFixed(0)}, max ${rtts[rtts.length - 1].toFixed(0)}, n=${rtts.length})`,
        );
      }

      if (this.droppedInboundMessages > 0) {
        console.warn(
          `Rate limited ${this.droppedInboundMessages} inbound message(s) since last report — ` +
          'client input was discarded',
        );
        this.droppedInboundMessages = 0;
      }

      if (this.saturatedFrames > 0) {
        console.warn(
          `Physics saturated on ${this.saturatedFrames} frame(s) since last report — shedding backlog`,
        );
        this.saturatedFrames = 0;
      }

      this.deltaTimes = [];
    }
  }

  private get gameProgress(): number {
    return (Math.max(this.bluePoints, this.redPoints) / this.options.scoreLimit) * 100;
  }

  public get serverInfo(): ServerInformation {
    return {
      serverName: this.serverName,
      playerCount: this.players.count,
      playerLimit: this.playerLimit,
      gameStatePercent: this.gameProgress,
    };
  }
}
