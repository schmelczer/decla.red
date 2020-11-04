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
  SecondaryActionCommand,
  settings,
  PlayerInformation,
  CharacterTeam,
  UpdateOtherPlayerDirections,
  GameObject,
  Command,
  OtherPlayerDirection,
  RemoteCallsForObject,
  RemoteCallsForObjects,
  ServerAnnouncement,
  PropertyUpdatesForObjects,
  PropertyUpdatesForObject,
  PrimaryActionCommand,
} from 'shared';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';
import { DeltaTimeCalculator } from '../helper/delta-time-calculator';

export class Player extends PlayerBase {
  private aspectRatio: number = 16 / 9;
  private isActive = true;

  private objectsPreviouslyInViewArea: Array<GameObject> = [];
  private pingDeltaTime = new DeltaTimeCalculator();
  private _latency?: number;

  protected commandExecutors: CommandExecutors = {
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) =>
      (this.aspectRatio = v.aspectRatio),
    [MoveActionCommand.type]: (c: MoveActionCommand) =>
      this.character?.handleMovementAction(c),
    [PrimaryActionCommand.type]: (c: PrimaryActionCommand) => {
      this.character?.shootTowards(c.position);
    },
  };

  constructor(
    playerInfo: PlayerInformation,
    playerContainer: PlayerContainer,
    objectContainer: PhysicalContainer,
    team: CharacterTeam,
    private readonly socket: SocketIO.Socket,
  ) {
    super(playerInfo, playerContainer, objectContainer, team);

    this.createCharacter();

    socket.on(
      TransportEvents.Pong,
      () => (this._latency = this.pingDeltaTime.getNextDeltaTimeInSeconds()),
    );

    this.measureLatency();
    this.step(0);
  }

  public measureLatency() {
    this.pingDeltaTime.getNextDeltaTimeInSeconds(true);
    this.socket.emit(TransportEvents.Ping);

    if (this.isActive) {
      setTimeout(this.measureLatency.bind(this), 10000);
    }
  }

  public get latency(): number | undefined {
    return this._latency;
  }

  protected createCharacter() {
    const preferredCenter = this.playerContainer.players.find(
      (p) => p.character?.isAlive && p.team === this.team,
    )?.center;

    super.createCharacter(preferredCenter ?? vec2.create());

    this.objectsPreviouslyInViewArea.push(this.character!);
    this.queueCommandSend(new CreatePlayerCommand(this.character!));
  }

  private timeSinceLastMessage = 0;
  private messageInterval = 1 / 30;
  private timeUntilRespawn = 0;
  public step(deltaTimeInSeconds: number) {
    this.timeSinceLastMessage += deltaTimeInSeconds;

    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      if (this.timeSinceLastMessage > this.messageInterval) {
        this.queueCommandSend(
          new ServerAnnouncement(`Reviving in ${Math.round(this.timeUntilRespawn)}…`),
        );
      }

      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        this.createCharacter();
        this.center = this.character!.center;
        this.queueCommandSend(new ServerAnnouncement(''));
      }
    }

    if (this.timeSinceLastMessage > this.messageInterval) {
      const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.2);
      const bb = new BoundingBox();
      bb.topLeft = viewArea.topLeft;
      bb.size = viewArea.size;

      const objectsInViewArea = Array.from(
        new Set(this.objectContainer.findIntersecting(bb).map((o) => o.gameObject)),
      );

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

      this.queueCommandSend(new UpdateOtherPlayerDirections(this.getOtherPlayers()));

      this.queueCommandSend(
        new PropertyUpdatesForObjects(
          this.objectsPreviouslyInViewArea
            .map((o) => o.getPropertyUpdates())
            .filter((u) => u) as Array<PropertyUpdatesForObject>,
        ),
      );
    }

    this.queueCommandSend(
      new RemoteCallsForObjects(
        this.objectsPreviouslyInViewArea.map(
          (g) => new RemoteCallsForObject(g.id, g.getRemoteCalls()),
        ),
      ),
    );

    if (this.timeSinceLastMessage > this.messageInterval) {
      this.sendQueuedCommandsToClient();
      this.timeSinceLastMessage = 0;
    }
  }

  private getOtherPlayers(): Array<OtherPlayerDirection> {
    if (!this.character) {
      return [];
    }

    const viewArea = calculateViewArea(this.center, this.aspectRatio, 0.9);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const playersInViewArea = this.objectContainer
      .findIntersecting(bb)
      .map((o) => o.gameObject)
      .filter((g) => g instanceof PlayerCharacterPhysical);

    const otherPlayers = this.playerContainer.players.filter(
      (p) => p.character?.isAlive && playersInViewArea.indexOf(p.character!) < 0,
    );

    return otherPlayers.map(
      (p) =>
        new OtherPlayerDirection(
          p.character!.id,
          vec2.normalize(
            vec2.create(),
            vec2.subtract(vec2.create(), p.character!.center, this.character!.center),
          ),
          p.team,
        ),
    );
  }

  private commandsToBeSent: Array<Command> = [];
  public queueCommandSend(command: Command) {
    this.commandsToBeSent.push(command);
  }

  public sendQueuedCommandsToClient() {
    this.socket.emit(TransportEvents.ServerToPlayer, serialize(this.commandsToBeSent));
    this.commandsToBeSent = [];
  }

  public destroy() {
    super.destroy();
    this.isActive = false;
  }
}
