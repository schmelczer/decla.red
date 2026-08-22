import { performance } from 'perf_hooks';
import { vec2 } from 'gl-matrix';
import {
  CommandExecutors,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  MoveActionCommand,
  serialize,
  TransportEvents,
  SetAspectRatioActionCommand,
  calculateViewArea,
  settings,
  PlayerInformation,
  CharacterTeam,
  UpdateMinimap,
  GameObject,
  Command,
  MinimapPlayer,
  RemoteCallsForObject,
  RemoteCallsForObjects,
  ServerAnnouncement,
  PropertyUpdatesForObjects,
  PropertyUpdatesForObject,
  PrimaryActionCommand,
  LeapActionCommand,
  InputAcknowledgement,
  ClientHeartbeatCommand,
  finiteInRange,
  finiteVec2,
  isFiniteNumber,
} from 'shared';
import { Socket } from 'socket.io';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';
import { CharacterPhysical } from '../objects/character-physical';

// How often the server pings each client to measure round-trip time.
const pingIntervalSeconds = 1;

// Aspect ratio is used to size the streamed view area; a zero, negative or
// non-finite value collapses it and the player stops receiving the world.
const minimumAspectRatio = 0.2;
const maximumAspectRatio = 8;

// How much unflushed data on the socket counts as "this client is not keeping
// up". See sendQueuedCommandsToClient.
const maximumBufferedBytes = settings.maxBufferedBytesPerClient;

export class Player extends PlayerBase {
  // default, until the clients sends its real value
  private aspectRatio: number = 16 / 9;
  private timeUntilRespawn = 0;
  private timeSinceLastMessage = 0;
  private objectsPreviouslyInViewArea: Array<GameObject> = [];
  private lastInputClientTimeMs = 0;
  private lastInputReceiptMs = 0;
  private lastLeapClientTimeMs = 0;

  // Token this session was issued at join. On a drop it is what the held score
  // is filed under, and what the returning client presents to reclaim it.
  public reconnectToken = '';

  // Measured round-trip time to this client (ms) — drives projectile lag
  // compensation as well as the server-side latency stats.
  public rttMs = 0;
  private timeSinceLastPing = 0;
  private lastPingSentMs = 0;
  // Nonce of the ping currently awaiting a reply, cleared once answered. Without
  // it a Pong was just a bare event: any client could send a stream of them, or
  // answer a ping it had sat on for a minute, and the RTT it produced feeds
  // projectile lag compensation.
  private pendingPingNonce = 0;
  private nextPingNonce = 1;

  // Nothing below trusts a field it was handed. Every one of these arrives
  // straight from `deserialize`, which is a bare JSON.parse — and JSON carries
  // Infinity happily as `1e999`. A single non-finite number reaching the
  // simulation is unrecoverable: it spreads through the shared SDF and leaves a
  // character that never dies and never respawns.
  protected commandExecutors: CommandExecutors = {
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) => {
      this.aspectRatio = finiteInRange(
        v.aspectRatio,
        minimumAspectRatio,
        maximumAspectRatio,
        this.aspectRatio,
      );
    },
    [MoveActionCommand.type]: (c: MoveActionCommand) => {
      const direction = finiteVec2(c.direction, 1);
      if (!direction) {
        return;
      }
      this.observeClientTime(c.clientTimeMs);
      this.character?.handleMovementAction(new MoveActionCommand(direction, 0));
    },
    [PrimaryActionCommand.type]: (c: PrimaryActionCommand) => {
      const position = finiteVec2(c.position, settings.maxClientPositionMagnitude);
      if (!position) {
        return;
      }
      this.observeClientTime(c.clientTimeMs);
      this.character?.shootTowards(
        position,
        finiteInRange(c.charge, 0, 1, 0),
        this.catchUpSeconds,
      );
    },
    [LeapActionCommand.type]: (c: LeapActionCommand) => {
      if (!isFiniteNumber(c.clientTimeMs)) {
        return;
      }
      // Record receipt (whether or not leap() accepts it): either way its effect
      // on bodyVelocity is now reflected in the streamed launch momentum, so the
      // predictor must stop replaying this leap.
      this.lastLeapClientTimeMs = c.clientTimeMs;
      this.observeClientTime(c.clientTimeMs);
      this.character?.leap();
    },
    // Closes every batch. Movement is only sent when it changes, so a held key
    // used to freeze the acknowledged input time — and with it the window the
    // client's predictor is allowed to replay. This advances the acknowledgement
    // at the client's send rate regardless of whether the input changed.
    [ClientHeartbeatCommand.type]: (c: ClientHeartbeatCommand) =>
      this.observeClientTime(c.clientTimeMs),
  };

  // The newest client-clock instant whose commands have all been applied, and
  // the server-clock instant it arrived at. The client's predictor needs both:
  // the first tells it which of its inputs are already reflected in the
  // snapshot, the second how stale that answer was by the time the snapshot was
  // taken (see InputAcknowledgement.ackAgeMs).
  private observeClientTime(clientTimeMs: number) {
    if (isFiniteNumber(clientTimeMs) && clientTimeMs > this.lastInputClientTimeMs) {
      this.lastInputClientTimeMs = clientTimeMs;
      this.lastInputReceiptMs = performance.now();
    }
  }

  // How long a command spent reaching us, for projectile lag compensation.
  // Deliberately derived from the measured RTT and NOT from the client's own
  // timestamp, so a forged stamp cannot buy extra compensation — which is why it
  // takes no argument. ProjectilePhysical.fastForward caps the result.
  private get catchUpSeconds(): number {
    return Math.max(0, this.rttMs / 2 / 1000);
  }

  constructor(
    playerInfo: PlayerInformation,
    playerContainer: PlayerContainer,
    objectContainer: PhysicalContainer,
    team: CharacterTeam,
    private readonly socket: Socket,
  ) {
    super(playerInfo, playerContainer, objectContainer, team);
    this.createCharacter();
    this.step(0);

    // The client already echoes a Pong for every Ping (see game.ts). Only one
    // ping is ever in flight, so RTT is simply now − send-time; no payload
    // needed and no client change required.
    this.socket.on(TransportEvents.Pong, this.onPong);
  }

  // Only the outstanding ping counts, and only once: a stale, duplicated or
  // invented reply is ignored. A client can still sit on the live ping to
  // inflate its measured RTT, so the result is clamped — and the next ping
  // retires the nonce, bounding the stall at one ping interval.
  private readonly onPong = (nonce: unknown) => {
    if (this.pendingPingNonce === 0 || nonce !== this.pendingPingNonce) {
      return;
    }
    this.pendingPingNonce = 0;
    this.rttMs = Math.min(
      performance.now() - this.lastPingSentMs,
      settings.maxMeasuredRttMs,
    );
  };

  // Fix 7a: the Pong listener outlives the round it belongs to unless it is
  // taken off explicitly — the socket survives a restart, so a retired Player
  // would stay reachable (and keep updating) through it.
  public detachFromSocket() {
    this.socket.off(TransportEvents.Pong, this.onPong);
  }

  protected createCharacter() {
    super.createCharacter();

    this.objectsPreviouslyInViewArea.push(this.character!);
    this.queueCommandSend(new CreatePlayerCommand(this.character!));
  }

  private winnerTeam?: CharacterTeam;
  public onGameEnded(winnerTeam: CharacterTeam) {
    this.winnerTeam = winnerTeam;
  }

  // The corpse a projectile may still credit a kill to. Kept so a shot that was
  // already in flight when we died is not thrown away: killCount is re-read at
  // respawn instead of being snapshotted the instant the body died.
  private dyingCharacter?: CharacterPhysical | null;

  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.dyingCharacter = this.character;
        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        if (this.dyingCharacter) {
          this.sumKills = Math.max(this.sumKills, this.dyingCharacter.killCount);
          this.dyingCharacter = null;
        }
        this.createCharacter();
        this.center = this.character!.center;
      }
    }
  }

  private handleViewAreaUpdate() {
    const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.2);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const objectsInViewArea = Array.from(
      new Set(this.objectContainer.findIntersecting(bb).map((o) => o.gameObject)),
    );

    // The owning character must always be in its own snapshot, regardless of the
    // view-area query, so the client predictor never loses its authoritative
    // anchor (the body can ride a fast spinner to the very edge of the box).
    if (this.character && !objectsInViewArea.includes(this.character)) {
      objectsInViewArea.push(this.character);
    }

    const newlyIntersecting = objectsInViewArea.filter(
      (o) => !this.objectsPreviouslyInViewArea.includes(o),
    );

    const noLongerIntersecting = this.objectsPreviouslyInViewArea.filter(
      (o) => !objectsInViewArea.includes(o),
    );

    this.objectsPreviouslyInViewArea = objectsInViewArea;

    if (noLongerIntersecting.length > 0) {
      this.queueCommandSend(
        new DeleteObjectsCommand(noLongerIntersecting.map((g) => g.id)),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.queueCommandSend(new CreateObjectsCommand(newlyIntersecting));
    }

    this.queueCommandSend(new UpdateMinimap(this.getMinimapPlayers()));

    this.queueCommandSend(
      new PropertyUpdatesForObjects(
        this.objectsPreviouslyInViewArea
          .map((o) => o.getPropertyUpdatesForFrame())
          .filter((u) => u) as Array<PropertyUpdatesForObject>,
        performance.now() / 1000,
      ),
    );

    // Tell the client how much of its own input is reflected in the snapshot it
    // just received, so its predictor can replay the rest. Only while alive —
    // a dead player isn't predicting.
    if (this.character) {
      this.queueCommandSend(
        new InputAcknowledgement(
          this.lastInputClientTimeMs,
          this.character.launchMomentum,
          this.lastLeapClientTimeMs,
          this.lastInputReceiptMs > 0
            ? Math.max(0, performance.now() - this.lastInputReceiptMs)
            : 0,
        ),
      );
    }
  }

  // Every living player except this one, reported by absolute world position so
  // the client can plot the whole circular arena on its minimap.
  private getMinimapPlayers(): Array<MinimapPlayer> {
    return this.playerContainer.players
      .filter((p) => p !== this && p.character?.isAlive)
      .map(
        (p) =>
          new MinimapPlayer(p.character!.id, vec2.clone(p.character!.center), p.team),
      );
  }

  private commandsToBeSent: Array<Command> = [];
  public queueCommandSend(command: Command) {
    this.commandsToBeSent.push(command);
  }

  public stepCommunications(deltaTime: number) {
    const remoteCalls = this.objectsPreviouslyInViewArea
      .map((g) => new RemoteCallsForObject(g.id, g.getRemoteCalls()))
      .filter((c) => c.calls.length > 0);

    if (remoteCalls.length > 0) {
      this.queueCommandSend(new RemoteCallsForObjects(remoteCalls));
    }

    if ((this.timeSinceLastPing += deltaTime) > pingIntervalSeconds) {
      this.timeSinceLastPing = 0;
      this.lastPingSentMs = performance.now();
      this.pendingPingNonce = this.nextPingNonce++;
      this.socket.emit(TransportEvents.Ping, this.pendingPingNonce);
    }

    if ((this.timeSinceLastMessage += deltaTime) > settings.updateMessageInterval) {
      this.handleAnnouncements();
      this.handleViewAreaUpdate();
      this.sendQueuedCommandsToClient();
      this.timeSinceLastMessage = 0;
    }
  }

  // Bytes written to this client's socket but not yet flushed to the network.
  // engine.io's own Socket exposes no such number — it lives on the underlying
  // ws socket, and only the websocket transport has one — so reading
  // `socket.conn.bufferedAmount` (as this did) always produced undefined and the
  // backpressure check below never once ran.
  private get bufferedBytes(): number {
    const conn = this.socket.conn as
      | { transport?: { socket?: { bufferedAmount?: unknown } } }
      | undefined;
    const buffered = conn?.transport?.socket?.bufferedAmount;
    return typeof buffered === 'number' ? buffered : 0;
  }

  public sendQueuedCommandsToClient() {
    if (this.commandsToBeSent.length === 0) {
      return;
    }

    // A client that is not draining gets the cheap half of the snapshot shed:
    // piling more state behind it only grows a backlog it will never catch up
    // on, and the freshest property update is the only one that matters.
    //
    // Only the state that next tick regenerates in full may be dropped. Create
    // and delete are one-shot: handleViewAreaUpdate has ALREADY advanced
    // objectsPreviouslyInViewArea by the time this runs, so dropping them leaves
    // this client permanently missing objects it was never told about and
    // holding ghosts it was never told to remove. Announcements and the end-game
    // card are one-shot for the same reason. They are small; they go out even
    // while backed up.
    if (this.bufferedBytes > maximumBufferedBytes) {
      // Matched by command type rather than `instanceof`, the same way every
      // other dispatch in the codebase does it — the identity of a class from a
      // bundled shared module is not something to depend on.
      const sheddable: ReadonlyArray<string> = [
        PropertyUpdatesForObjects.type,
        UpdateMinimap.type,
      ];
      this.commandsToBeSent = this.commandsToBeSent.filter(
        (c) => !sheddable.includes(c.type),
      );
      if (this.commandsToBeSent.length === 0) {
        return;
      }
    }

    this.socket.emit(TransportEvents.ServerToPlayer, serialize(this.commandsToBeSent));
    this.commandsToBeSent = [];
  }

  /** Score to hold for this player if it reconnects inside the grace window. */
  public get scoreSnapshot(): { kills: number; deaths: number } {
    return {
      kills: Math.max(this.sumKills, this.character?.killCount ?? 0),
      deaths: this.sumDeaths,
    };
  }

  private handleAnnouncements() {
    let announcement = '';
    if (this.winnerTeam) {
      announcement = `Team <span class="${this.winnerTeam}">${this.winnerTeam}</span> won 🎉`;
    } else if (!this.character) {
      announcement = `Reviving in ${Math.round(this.timeUntilRespawn)}…`;
    }

    if (announcement) {
      this.queueCommandSend(new ServerAnnouncement(announcement));
    }
  }
}
