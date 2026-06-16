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
} from 'shared';
import { Socket } from 'socket.io';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';

// How often the server pings each client to measure round-trip time.
const pingIntervalSeconds = 1;

export class Player extends PlayerBase {
  // default, until the clients sends its real value
  private aspectRatio: number = 16 / 9;
  private timeUntilRespawn = 0;
  private timeSinceLastMessage = 0;
  private objectsPreviouslyInViewArea: Array<GameObject> = [];
  private lastInputClientTimeMs = 0;
  private lastLeapClientTimeMs = 0;

  // Measured round-trip time to this client (ms) — the latency primitive that
  // lag compensation, a latency HUD, and adaptive interpolation build on.
  public rttMs = 0;
  private timeSinceLastPing = 0;
  private lastPingSentMs = 0;

  protected commandExecutors: CommandExecutors = {
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) =>
      (this.aspectRatio = v.aspectRatio),
    [MoveActionCommand.type]: (c: MoveActionCommand) => {
      // Remember how far into this client's input timeline we've consumed, to
      // echo back for client-side prediction reconciliation.
      this.lastInputClientTimeMs = c.clientTimeMs;
      this.character?.handleMovementAction(c);
    },
    [PrimaryActionCommand.type]: (c: PrimaryActionCommand) =>
      this.character?.shootTowards(c.position, c.charge),
    [LeapActionCommand.type]: (c: LeapActionCommand) => {
      // Record receipt (whether or not leap() accepts it): either way its effect
      // on bodyVelocity is now reflected in the streamed launch momentum, so the
      // predictor must stop replaying this leap.
      this.lastLeapClientTimeMs = c.clientTimeMs;
      this.character?.leap();
    },
  };

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
    this.socket.on(TransportEvents.Pong, () => {
      if (this.lastPingSentMs > 0) {
        this.rttMs = performance.now() - this.lastPingSentMs;
      }
    });
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

  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
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
          .map((o) => o.getPropertyUpdates())
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
      this.socket.emit(TransportEvents.Ping);
    }

    if ((this.timeSinceLastMessage += deltaTime) > settings.updateMessageInterval) {
      this.handleAnnouncements();
      this.handleViewAreaUpdate();
      this.sendQueuedCommandsToClient();
      this.timeSinceLastMessage = 0;
    }
  }

  public sendQueuedCommandsToClient() {
    this.socket.emit(TransportEvents.ServerToPlayer, serialize(this.commandsToBeSent));
    this.commandsToBeSent = [];
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
