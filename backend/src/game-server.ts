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
  ServerAnnouncement,
  JoinRejectionReason,
  GameObject,
  PropertyUpdatesForObject,
} from 'shared';
import { PhysicalContainer } from './physics/physical-container';
import { createWorld } from './create-world';
import { Options } from './options';
import { GameEvents } from './game-events';
import { CarriedScore, PlayerContainer } from './players/player-container';
import { Player } from './players/player';

const gameStateSubscribedRoom = 'gameStateSubscribedRoom';
const endTitleSeconds = 6;

const asPlayerInformation = (payload: unknown): PlayerInformation | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const { name, reconnectToken } = payload as Record<string, unknown>;
  return {
    name: name as string,
    reconnectToken: typeof reconnectToken === 'string' ? reconnectToken : undefined,
  };
};

export class GameServer implements GameEvents {
  private objects!: PhysicalContainer;
  private players!: PlayerContainer;
  private lastPhysicsBase = process.hrtime.bigint();

  private bluePoints = 0;
  private redPoints = 0;
  private matchPointAnnounced: Partial<Record<CharacterTeam, boolean>> = {};

  private isInEndGame = false;
  private timeScaling = 1;
  private statReportMs = Date.now();
  private timeSinceLastServerStateUpdate = 0;
  private timeSinceLastPointUpdate = 0;
  private physicsAccumulator = 0;
  private saturatedFrames = 0;
  private droppedInboundMessages = 0;

  private readonly joinedSockets = new Map<
    Socket,
    { player: Player; release: () => void }
  >();
  private inboundBudget = new WeakMap<Socket, { tokens: number; lastMs: number }>();

  constructor(
    private readonly io: Server,
    private options: Options,
  ) {
    this.initialize();

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
        if (this.allowInboundMessage(socket)) {
          socket.join(gameStateSubscribedRoom);
        }
      });
    });
  }

  private initialize() {
    const previousPlayers = this.players;
    this.joinedSockets.forEach(({ release }) => release());
    this.joinedSockets.clear();
    this.inboundBudget = new WeakMap();

    this.objects = new PhysicalContainer(this);
    createWorld(this.objects);
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
    this.physicsAccumulator = 0;
    this.timeSinceLastServerStateUpdate = 0;
    this.timeSinceLastPointUpdate = 0;
    previousPlayers?.queueCommandForEachClient(new GameStartCommand());
    previousPlayers?.sendQueuedCommands();
  }

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

    const carried = this.retireGhost(playerInfo.reconnectToken);

    if (this.players.isFull) {
      socket.emit(TransportEvents.JoinRejected, JoinRejectionReason.ServerFull);
      return;
    }

    const player = this.players.createPlayer(playerInfo, socket, carried);

    const onPlayerToServer = (json: unknown) => {
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

  private allowInboundMessage(socket: Socket): boolean {
    // performance.now(), not Date.now(): a backwards wall-clock step would lock the client out.
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
        const carried = { team: player.team, ...player.score };
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
    joined.release();
    joined.player.destroy();
    this.players.deletePlayer(joined.player);
  }

  public sendServerStateUpdate() {
    this.io
      .to(gameStateSubscribedRoom)
      .emit(TransportEvents.ServerInfoUpdate, [
        this.players.count,
        this.serverInfo.gameStatePercent,
      ]);
  }

  public start() {
    this.handlePhysics();
  }

  public addPoints(blue: number, red: number) {
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

  public announce(text: string) {
    this.players.queueCommandForEachClient(new ServerAnnouncement(text));
  }

  private announceMatchPointOnce(team: CharacterTeam, points: number) {
    if (
      !this.matchPointAnnounced[team] &&
      points >= this.options.scoreLimit * settings.matchPointScoreRatio
    ) {
      this.matchPointAnnounced[team] = true;
      this.announce(`Match point: team <span class="${team}">${team}</span>!`);
    }
  }

  private endGame(winningTeam: CharacterTeam) {
    this.isInEndGame = true;
    this.players.endGame(winningTeam);
    this.players.queueCommandForEachClient(new GameEndCommand());
    setTimeout(() => this.initialize(), endTitleSeconds * 1000 * 1.1);
  }

  private reportStats() {
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

  private handlePhysics() {
    const frameStart = process.hrtime.bigint();
    const frameStartMs = performance.now();
    const delta = Number(frameStart - this.lastPhysicsBase) / 1e9;
    this.lastPhysicsBase = frameStart;

    if (Date.now() - this.statReportMs > 30000) {
      this.statReportMs = Date.now();
      this.reportStats();
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
      this.objects.step(scaledDelta);
      this.players.step(scaledDelta);
    }

    // Physics has only advanced to the start of this frame less whatever is still in the
    // accumulator. Timing anything off the send time instead would put up to one physics step
    // of noise on every interpolated position and on the client's replay anchor.
    const simulatedThroughMs = frameStartMs - this.physicsAccumulator * 1000;

    if (substeps > 0) {
      const propertyUpdates = new Map<GameObject, PropertyUpdatesForObject | undefined>();
      this.players.stepCommunication(
        substeps * fixedDelta,
        simulatedThroughMs,
        (object) => {
          if (!propertyUpdates.has(object)) {
            propertyUpdates.set(object, object.getPropertyUpdates(1 / this.timeScaling));
          }
          return propertyUpdates.get(object);
        },
      );
      this.objects.resetRemoteCalls();
    }

    const elapsed = Number(process.hrtime.bigint() - frameStart) / 1e9;
    setTimeout(() => this.handlePhysics(), Math.max(0, fixedDelta - elapsed) * 1000);
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
