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
import { BoundingBox } from '../physics/bounding-box';
import { PhysicalContainer } from '../physics/physical-container';
import { PlayerContainer } from './player-container';
import { PlayerBase, Score } from './player-base';
import { CharacterPhysical } from '../objects/character-physical';

const pingIntervalSeconds = 1;
const minimumAspectRatio = 0.2;
const maximumAspectRatio = 8;

const sheddableWhenBackedUp: ReadonlyArray<string> = [
  PropertyUpdatesForObjects.type,
  UpdateMinimap.type,
  InputAcknowledgement.type,
];

export class Player extends PlayerBase {
  public reconnectToken = '';
  public rttMs = 0;

  private aspectRatio = 16 / 9;
  private timeSinceLastMessage = 0;
  private objectsInViewArea = new Set<GameObject>();
  private commandsToBeSent: Array<Command> = [];
  private winnerTeam?: CharacterTeam;

  private lastInputClientTimeMs = 0;
  private lastInputReceiptMs = 0;
  private lastLeapClientTimeMs = 0;

  private timeSinceLastPing = 0;
  private lastPingSentMs = 0;
  private pendingPingNonce = 0;
  private nextPingNonce = 1;

  // Input is untrusted: one non-finite value reaching the simulation leaves a character that never dies.
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
      this.character?.setMoveDirection(direction);
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
      this.lastLeapClientTimeMs = c.clientTimeMs;
      this.observeClientTime(c.clientTimeMs);
      this.character?.leap();
    },
    [ClientHeartbeatCommand.type]: (c: ClientHeartbeatCommand) =>
      this.observeClientTime(c.clientTimeMs),
  };

  constructor(
    playerInfo: PlayerInformation,
    playerContainer: PlayerContainer,
    objectContainer: PhysicalContainer,
    team: CharacterTeam,
    private readonly socket: Socket,
    score?: Score,
  ) {
    super(playerInfo, playerContainer, objectContainer, team, score);
    this.createCharacter();
    this.socket.on(TransportEvents.Pong, this.onPong);
  }

  private observeClientTime(clientTimeMs: number) {
    if (isFiniteNumber(clientTimeMs) && clientTimeMs > this.lastInputClientTimeMs) {
      this.lastInputClientTimeMs = clientTimeMs;
      this.lastInputReceiptMs = performance.now();
    }
  }

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

  public detachFromSocket() {
    this.socket.off(TransportEvents.Pong, this.onPong);
  }

  protected createCharacter(): CharacterPhysical {
    const character = super.createCharacter();
    this.objectsInViewArea.add(character);
    this.queueCommandSend(new CreatePlayerCommand(character));
    return character;
  }

  public onGameEnded(winnerTeam: CharacterTeam) {
    this.winnerTeam = winnerTeam;
  }

  public step(deltaTimeInSeconds: number) {
    this.stepLifecycle(deltaTimeInSeconds);
  }

  public queueCommandSend(command: Command) {
    this.commandsToBeSent.push(command);
  }

  public stepCommunications(
    deltaTime: number,
    simulatedThroughMs: number,
    propertyUpdatesOf: (object: GameObject) => PropertyUpdatesForObject | undefined,
  ) {
    const remoteCalls: Array<RemoteCallsForObject> = [];
    for (const object of this.objectsInViewArea) {
      const calls = object.getRemoteCalls();
      if (calls.length > 0) {
        remoteCalls.push(new RemoteCallsForObject(object.id, calls));
      }
    }
    if (remoteCalls.length > 0) {
      this.queueCommandSend(new RemoteCallsForObjects(remoteCalls));
    }

    if ((this.timeSinceLastPing += deltaTime) > pingIntervalSeconds) {
      this.timeSinceLastPing = 0;
      this.lastPingSentMs = performance.now();
      this.pendingPingNonce = this.nextPingNonce++;
      this.socket.emit(TransportEvents.Ping, this.pendingPingNonce);
    }

    // Subtracted, not zeroed: zeroing would stretch every interval to the next physics frame.
    if ((this.timeSinceLastMessage += deltaTime) > settings.updateMessageInterval) {
      this.timeSinceLastMessage = Math.min(
        this.timeSinceLastMessage - settings.updateMessageInterval,
        settings.updateMessageInterval,
      );
      this.queueAnnouncement();
      this.queueSnapshot(simulatedThroughMs, propertyUpdatesOf);
      this.sendQueuedCommandsToClient();
    }
  }

  private queueSnapshot(
    simulatedThroughMs: number,
    propertyUpdatesOf: (object: GameObject) => PropertyUpdatesForObject | undefined,
  ) {
    const { topLeft, size } = calculateViewArea(this.center, this.aspectRatio, 1.2);
    const viewBox = new BoundingBox(
      topLeft[0],
      topLeft[0] + size[0],
      topLeft[1] - size[1],
      topLeft[1],
    );

    const inViewArea = new Set(
      this.objectContainer.findIntersecting(viewBox).map((o) => o.gameObject),
    );
    if (this.character) {
      inViewArea.add(this.character);
    }

    const created = [...inViewArea].filter((o) => !this.objectsInViewArea.has(o));
    const deleted = [...this.objectsInViewArea].filter((o) => !inViewArea.has(o));
    this.objectsInViewArea = inViewArea;

    if (deleted.length > 0) {
      this.queueCommandSend(new DeleteObjectsCommand(deleted.map((g) => g.id)));
    }
    if (created.length > 0) {
      this.queueCommandSend(new CreateObjectsCommand(created));
    }

    this.queueCommandSend(new UpdateMinimap(this.getMinimapPlayers()));

    const propertyUpdates: Array<PropertyUpdatesForObject> = [];
    for (const object of this.objectsInViewArea) {
      const update = propertyUpdatesOf(object);
      if (update) {
        propertyUpdates.push(update);
      }
    }
    this.queueCommandSend(
      new PropertyUpdatesForObjects(propertyUpdates, simulatedThroughMs / 1000),
    );

    if (this.character) {
      this.queueCommandSend(
        new InputAcknowledgement(
          this.lastInputClientTimeMs,
          this.character.movementSnapshot,
          this.lastLeapClientTimeMs,
          // Aged against the instant the pose is from, not the send time: the difference is
          // the un-simulated remainder, and it would land straight in the client's replay.
          this.lastInputReceiptMs > 0
            ? Math.max(0, simulatedThroughMs - this.lastInputReceiptMs)
            : 0,
        ),
      );
    }
  }

  private getMinimapPlayers(): Array<MinimapPlayer> {
    return this.playerContainer.players
      .filter((p) => p !== this && p.character?.isAlive)
      .map(
        (p) =>
          new MinimapPlayer(p.character!.id, vec2.clone(p.character!.center), p.team),
      );
  }

  private get bufferedBytes(): number {
    const conn = this.socket.conn as
      | { transport?: { socket?: { bufferedAmount?: unknown } } }
      | undefined;
    const buffered = conn?.transport?.socket?.bufferedAmount;
    return typeof buffered === 'number' ? buffered : 0;
  }

  public sendQueuedCommandsToClient() {
    // Only state the next snapshot regenerates may be dropped; create/delete are one-shot.
    if (this.bufferedBytes > settings.maxBufferedBytesPerClient) {
      this.commandsToBeSent = this.commandsToBeSent.filter(
        (c) => !sheddableWhenBackedUp.includes(c.type),
      );
    }
    if (this.commandsToBeSent.length === 0) {
      return;
    }

    this.socket.emit(TransportEvents.ServerToPlayer, serialize(this.commandsToBeSent));
    this.commandsToBeSent = [];
  }

  private queueAnnouncement() {
    if (this.winnerTeam) {
      this.queueCommandSend(
        new ServerAnnouncement(
          `Team <span class="${this.winnerTeam}">${this.winnerTeam}</span> won 🎉`,
        ),
      );
    } else if (!this.character) {
      this.queueCommandSend(
        new ServerAnnouncement(`Reviving in ${Math.round(this.timeUntilRespawn)}…`),
      );
    }
  }
}
