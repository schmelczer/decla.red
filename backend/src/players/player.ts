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

const pingIntervalSeconds = 1;

const minimumAspectRatio = 0.2;
const maximumAspectRatio = 8;

const maximumBufferedBytes = settings.maxBufferedBytesPerClient;

export class Player extends PlayerBase {
  private aspectRatio: number = 16 / 9;
  private timeSinceLastMessage = 0;
  // A Set: the per-snapshot diff is membership-heavy, and insertion-order
  // iteration keeps the streamed object order unchanged.
  private objectsInViewArea = new Set<GameObject>();
  private lastInputClientTimeMs = 0;
  private lastInputReceiptMs = 0;
  private lastLeapClientTimeMs = 0;

  public reconnectToken = '';

  // Drives projectile lag compensation as well as the server-side latency stats.
  public rttMs = 0;
  private timeSinceLastPing = 0;
  private lastPingSentMs = 0;
  // Nonce of the ping awaiting a reply: prevents a client forging Pongs or
  // answering a stale ping to corrupt the RTT that feeds lag compensation.
  private pendingPingNonce = 0;
  private nextPingNonce = 1;

  // Input below is untrusted: every command arrives from `deserialize`
  // (a bare JSON.parse, which accepts Infinity as `1e999`). A single
  // non-finite value reaching the simulation is unrecoverable — it spreads
  // through the shared SDF and leaves a character that never dies or respawns.
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
      this.character?.shootTowards(position, finiteInRange(c.charge, 0, 1, 0));
    },
    [LeapActionCommand.type]: (c: LeapActionCommand) => {
      if (!isFiniteNumber(c.clientTimeMs)) {
        return;
      }
      // Record receipt whether or not leap() accepts it: the predictor must
      // stop replaying this leap either way.
      this.lastLeapClientTimeMs = c.clientTimeMs;
      this.observeClientTime(c.clientTimeMs);
      this.character?.leap();
    },
    // Advances the acknowledgement at the client's send rate regardless of
    // whether input changed — otherwise a held key freezes the predictor's
    // replay window.
    [ClientHeartbeatCommand.type]: (c: ClientHeartbeatCommand) =>
      this.observeClientTime(c.clientTimeMs),
  };

  // Tracks both the newest applied client-clock instant and the server-clock
  // instant it arrived. The predictor needs both: which inputs are already in
  // the snapshot, and how stale that answer was (see InputAcknowledgement).
  private observeClientTime(clientTimeMs: number) {
    if (isFiniteNumber(clientTimeMs) && clientTimeMs > this.lastInputClientTimeMs) {
      this.lastInputClientTimeMs = clientTimeMs;
      this.lastInputReceiptMs = performance.now();
    }
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

    // Only one ping is ever in flight, so RTT is simply now − send-time.
    this.socket.on(TransportEvents.Pong, this.onPong);
  }

  // Only the outstanding ping's nonce counts, once. A client can sit on the
  // live ping to inflate measured RTT, so the result is clamped; the next ping
  // retires the nonce, bounding any stall at one ping interval.
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

  // The Pong listener outlives the round: the socket survives a restart, so a
  // retired Player would stay reachable through it unless removed explicitly.
  public detachFromSocket() {
    this.socket.off(TransportEvents.Pong, this.onPong);
  }

  protected createCharacter() {
    super.createCharacter();

    this.objectsInViewArea.add(this.character!);
    this.queueCommandSend(new CreatePlayerCommand(this.character!));
  }

  private winnerTeam?: CharacterTeam;
  public onGameEnded(winnerTeam: CharacterTeam) {
    this.winnerTeam = winnerTeam;
  }

  // Retained so an in-flight shot can still credit a kill to this corpse:
  // killCount is re-read at respawn, not snapshotted when the body died.
  private dyingCharacter?: CharacterPhysical | null;

  public step(deltaTimeInSeconds: number) {
    this.stepLifecycle(deltaTimeInSeconds);
  }

  protected onCharacterDied(character: CharacterPhysical) {
    this.dyingCharacter = character;
  }

  protected onBeforeRespawn() {
    if (this.dyingCharacter) {
      this.sumKills = Math.max(this.sumKills, this.dyingCharacter.killCount);
      this.dyingCharacter = null;
    }
  }

  private handleViewAreaUpdate() {
    const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.2);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const inViewArea = new Set(
      this.objectContainer.findIntersecting(bb).map((o) => o.gameObject),
    );

    // The owning character must always be in its own snapshot so the client
    // predictor never loses its authoritative anchor.
    if (this.character) {
      inViewArea.add(this.character);
    }

    // Set membership rather than Array.includes: this diff runs per player per
    // snapshot over everything on screen and was quadratic in that.
    const newlyIntersecting = [...inViewArea].filter(
      (o) => !this.objectsInViewArea.has(o),
    );

    const noLongerIntersecting = [...this.objectsInViewArea].filter(
      (o) => !inViewArea.has(o),
    );

    this.objectsInViewArea = inViewArea;

    if (noLongerIntersecting.length > 0) {
      this.queueCommandSend(
        new DeleteObjectsCommand(noLongerIntersecting.map((g) => g.id)),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.queueCommandSend(new CreateObjectsCommand(newlyIntersecting));
    }

    this.queueCommandSend(new UpdateMinimap(this.getMinimapPlayers()));

    const propertyUpdates: Array<PropertyUpdatesForObject> = [];
    for (const object of this.objectsInViewArea) {
      const update = object.getPropertyUpdatesForFrame();
      if (update) {
        propertyUpdates.push(update);
      }
    }
    this.queueCommandSend(
      new PropertyUpdatesForObjects(propertyUpdates, performance.now() / 1000),
    );

    // Tells the client how much of its own input is reflected in the snapshot
    // so its predictor can replay the rest. Only while alive.
    if (this.character) {
      this.queueCommandSend(
        new InputAcknowledgement(
          this.lastInputClientTimeMs,
          this.character.movementSnapshot,
          this.lastLeapClientTimeMs,
          this.lastInputReceiptMs > 0
            ? Math.max(0, performance.now() - this.lastInputReceiptMs)
            : 0,
        ),
      );
    }
  }

  // Every living player except this one, by absolute world position for the
  // minimap.
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
    // Test first and only build the command when there is something to send.
    let remoteCalls: Array<RemoteCallsForObject> | undefined;
    for (const object of this.objectsInViewArea) {
      const calls = object.getRemoteCalls();
      if (calls.length > 0) {
        (remoteCalls ??= []).push(new RemoteCallsForObject(object.id, calls));
      }
    }

    if (remoteCalls) {
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

  // engine.io's Socket exposes no bufferedAmount — it lives on the underlying
  // ws socket, and only the websocket transport has one.
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

    // Only state next tick regenerates in full may be dropped. Create/delete
    // are one-shot: handleViewAreaUpdate has ALREADY advanced
    // objectsPreviouslyInViewArea, so dropping them leaves this client
    // permanently missing objects and holding ghosts. They go out even backed up.
    if (this.bufferedBytes > maximumBufferedBytes) {
      // Matched by command type, not `instanceof`: a class identity from a
      // bundled shared module is not something to depend on.
      const sheddable: ReadonlyArray<string> = [
        PropertyUpdatesForObjects.type,
        UpdateMinimap.type,
        // Regenerated in full next tick — shed with the pose, never advance the
        // replay anchor past a snapshot the client never received.
        InputAcknowledgement.type,
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
