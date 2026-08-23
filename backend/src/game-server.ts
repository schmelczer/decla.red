import { PhysicalContainer } from './physics/containers/physical-container';
import { Server, Socket } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
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
import { CarriedScore, PlayerContainer } from './players/player-container';
import { ServerFullError } from './players/server-full-error';
import { Player } from './players/player';
import { StepCommand, GeneratePointsCommand, AnnounceCommand } from './commands/commands';

const gameStateSubscribedRoom = 'gameStateSubscribedRoom';

// The payload is whatever the client sent: `socket.emit('PlayerJoining')` with
// no argument arrives as undefined. socket.io dispatches listeners inside a
// `process.nextTick` with no try/catch of its own, so a dereference of an
// unchecked payload here would surface as an uncaught exception and take the
// whole match down with the process.
const asPlayerInformation = (payload: unknown): PlayerInformation | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const { name, reconnectToken } = payload as Record<string, unknown>;
  return {
    // Coerced and length-capped downstream, in PlayerBase.createCharacter.
    name: name as string,
    reconnectToken: typeof reconnectToken === 'string' ? reconnectToken : undefined,
  };
};

export class GameServer extends CommandReceiver {
  private objects!: PhysicalContainer;
  private players!: PlayerContainer;
  private lastPhysicsBase = process.hrtime.bigint();

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
    this.lastPhysicsBase = process.hrtime.bigint();
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

    // Both listeners are metered: they exist before any join, so the limiter
    // inside onPlayerToServer cannot see them, and each one costs a reply or an
    // allocation an unauthenticated client could otherwise ask for at line rate.
    io.on('connection', (socket: Socket) => {
      socket.on(TransportEvents.PlayerJoining, (payload: unknown) => {
        if (!this.allowInboundMessage(socket)) {
          return;
        }
        try {
          this.handleJoin(socket, payload);
        } catch (e) {
          console.error('Failed to handle a join request', e);
          socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.InvalidRequest);
          socket.disconnect();
        }
      });

      socket.on(TransportEvents.SubscribeForServerInfoUpdates, () => {
        if (!this.allowInboundMessage(socket)) {
          return;
        }
        socket.join(gameStateSubscribedRoom);
      });
    });
  }

  private readonly joinedSockets = new Map<
    Socket,
    { player: Player; release: () => void }
  >();

  private handleJoin(socket: Socket, payload: unknown) {
    const playerInfo = asPlayerInformation(payload);
    if (!playerInfo) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.InvalidRequest);
      return;
    }

    if (this.joinedSockets.has(socket)) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.AlreadyJoined);
      return;
    }

    if (this.isInEndGame) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.RoundEnding);
      return;
    }

    // A reconnect arrives seconds after the drop, long before engine.io times
    // the dead socket out. Retire that ghost first so its slot, team and score
    // go back to the returning client.
    const carried = this.retireGhost(playerInfo.reconnectToken);

    if (this.players.isFull) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.ServerFull);
      return;
    }

    let player: Player;
    try {
      player = this.players.createPlayer(playerInfo, socket, carried);
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
      this.removeJoined(socket);
      this.sendServerStateUpdate();
    };

    socket.on(TransportEvents.PlayerToServer, onPlayerToServer);
    socket.on('disconnect', onDisconnect);
    this.joinedSockets.set(socket, {
      player,
      release: () => {
        socket.off(TransportEvents.PlayerToServer, onPlayerToServer);
        socket.off('disconnect', onDisconnect);
        player.detachFromSocket();
      },
    });

    player.reconnectToken = randomUUID();
    socket.emit(TransportEvents.PlayerJoined, player.reconnectToken);

    this.sendServerStateUpdate();
  }

  // A WeakMap, not a Map: sockets that never join are metered too, and they
  // have no join-scoped teardown to remove their entry.
  private inboundBudget = new WeakMap<Socket, { tokens: number; lastMs: number }>();
  private droppedInboundMessages = 0;
  private allowInboundMessage(socket: Socket): boolean {
    // performance.now(), never Date.now(): a backwards wall-clock step (an NTP
    // correction, a VM resync) would make the refill negative and lock the
    // client out of sending input for as long as the step was.
    const nowMs = performance.now();
    const burst = settings.maxInboundMessageBurst;
    const perSecond = settings.maxInboundMessagesPerSecond;

    const budget = this.inboundBudget.get(socket) ?? { tokens: burst, lastMs: nowMs };
    budget.tokens = Math.min(
      burst,
      budget.tokens + (Math.max(0, nowMs - budget.lastMs) / 1000) * perSecond,
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

  private retireGhost(token?: string): CarriedScore | undefined {
    if (!token) {
      return undefined;
    }
    for (const [socket, { player }] of this.joinedSockets) {
      if (player.reconnectToken === token) {
        const carried = { team: player.team, ...player.scoreSnapshot };
        this.removeJoined(socket);
        return carried;
      }
    }
    return undefined;
  }

  private removeJoined(socket: Socket) {
    const joined = this.joinedSockets.get(socket);
    if (!joined) {
      return;
    }
    this.joinedSockets.delete(socket);
    this.inboundBudget.delete(socket);
    // Only the listeners this join added: socket.io keeps its own internal
    // 'error' guard and the connection-scoped PlayerJoining handler here.
    joined.release();
    joined.player.destroy();
    this.players.deletePlayer(joined.player);
  }

  private releaseJoinedSockets() {
    this.joinedSockets.forEach(({ release }) => release());
    this.joinedSockets.clear();
    this.inboundBudget = new WeakMap();
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
    const frameStart = process.hrtime.bigint();
    const delta = Number(frameStart - this.lastPhysicsBase) / 1e9;
    this.lastPhysicsBase = frameStart;

    if (Date.now() - this.statReportMs > 30000) {
      this.statReportMs = Date.now();
      const mem = `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`;
      console.info(`Memory: ${mem}, Players: ${this.players.count}`);

      const rtts = this.players.connectedPlayerRttsMs.filter((r) => r > 0);
      if (rtts.length > 0) {
        rtts.sort((a, b) => a - b);
        console.info(
          `RTT median ${rtts[Math.floor(rtts.length / 2)].toFixed(0)} ms ` +
            `(min ${rtts[0].toFixed(0)}, max ${rtts[rtts.length - 1].toFixed(0)}, n=${rtts.length})`,
        );
      }

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

    const elapsed = Number(process.hrtime.bigint() - frameStart) / 1e9;

    setTimeout(this.handlePhysics.bind(this), Math.max(0, fixedDelta - elapsed) * 1000);
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
