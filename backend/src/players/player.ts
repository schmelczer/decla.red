import { vec2 } from 'gl-matrix';
import {
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  MoveActionCommand,
  serialize,
  TransportEvents,
  SetAspectRatioActionCommand,
  calculateViewArea,
  SecondaryActionCommand,
  PlayerDiedCommand,
  settings,
  Circle,
  PlayerInformation,
  CharacterTeam,
  UpdateOtherPlayerDirections,
  GameObject,
  Command,
  OtherPlayerDirection,
  RemoteCallsForObject,
  RemoteCallsForObjects,
  ServerAnnouncement,
} from 'shared';
import { getTimeInMilliseconds } from '../helper/get-time-in-milliseconds';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { PlanetPhysical } from '../objects/planet-physical';
import { PlayerContainer } from './player-container';

export class Player extends CommandReceiver {
  private character?: PlayerCharacterPhysical | null;
  private aspectRatio: number = 16 / 9;
  private isActive = true;

  private sumKills = 0;
  private sumDeaths = 0;

  private objectsPreviouslyInViewArea: Array<GameObject> = [];

  private pingTime?: number;
  private _latency?: number;
  public measureLatency() {
    this.pingTime = getTimeInMilliseconds();
    this.socket.emit(TransportEvents.Ping);
    if (this.isActive) {
      setTimeout(this.measureLatency.bind(this), 10000);
    }
  }

  public get latency(): number | undefined {
    return this._latency;
  }

  protected commandExecutors: CommandExecutors = {
    [SetAspectRatioActionCommand.type]: (v: SetAspectRatioActionCommand) =>
      (this.aspectRatio = v.aspectRatio),
    [MoveActionCommand.type]: (c: MoveActionCommand) =>
      this.character?.handleMovementAction(c),
    [SecondaryActionCommand.type]: (c: SecondaryActionCommand) => {
      this.character?.shootTowards(c.position);
    },
  };

  constructor(
    private readonly playerInfo: PlayerInformation,
    private readonly playerContainer: PlayerContainer,
    private readonly objectContainer: PhysicalContainer,
    public readonly socket: SocketIO.Socket,
    public readonly team: CharacterTeam,
  ) {
    super();
    this.team = team;

    this.createCharacter();

    socket.on(
      TransportEvents.Pong,
      () => (this._latency = getTimeInMilliseconds() - this.pingTime!),
    );

    this.measureLatency();
    this.step(0);
  }

  private createCharacter() {
    this.character = new PlayerCharacterPhysical(
      this.playerInfo.name.slice(0, 20),
      this.sumKills,
      this.sumDeaths,
      this.team,
      this.objectContainer,
      this.findEmptyPositionForPlayer(),
    );

    this.objectContainer.addObject(this.character);
    this.objectsPreviouslyInViewArea.push(this.character);

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(new CreatePlayerCommand(this.character)),
    );
  }

  private center: vec2 = vec2.create();
  private timeUntilRespawn = 0;
  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.socket.emit(
          TransportEvents.ServerToPlayer,
          serialize(new PlayerDiedCommand(settings.playerDiedTimeout)),
        );
        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      this.sendToPlayer(
        new ServerAnnouncement(`Reviving in ${Math.round(this.timeUntilRespawn)}…`),
      );
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        this.createCharacter();
        this.center = this.character!.center;
        this.sendToPlayer(new ServerAnnouncement(''));
      }
    }

    const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.5);
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
      this.sendToPlayer(new DeleteObjectsCommand(noLongerIntersecting.map((g) => g.id)));
    }

    if (newlyIntersecting.length > 0) {
      this.sendToPlayer(new CreateObjectsCommand(newlyIntersecting));
    }

    this.sendToPlayer(
      new RemoteCallsForObjects(
        this.objectsPreviouslyInViewArea.map(
          (g) => new RemoteCallsForObject(g.id, g.getRemoteCalls()),
        ),
      ),
    );

    this.sendToPlayer(new UpdateOtherPlayerDirections(this.getOtherPlayers()));
  }

  private findEmptyPositionForPlayer(): vec2 {
    let possibleCenter = this.playerContainer.players.find(
      (p) => p.character?.isAlive && p.team === this.team,
    )?.center;

    if (!possibleCenter) {
      possibleCenter = vec2.create();
    }

    let rotation = 0;
    let radius = 0;
    for (;;) {
      const playerPosition = vec2.fromValues(
        radius * Math.cos(rotation) + possibleCenter.x,
        radius * Math.sin(rotation) + possibleCenter.y,
      );

      const playerBoundingCircle = new Circle(
        playerPosition,
        PlayerCharacterPhysical.boundRadius,
      );

      const playerBoundingBox = getBoundingBoxOfCircle(playerBoundingCircle);
      const possibleIntersectors = this.objectContainer.findIntersecting(
        playerBoundingBox,
      );
      if (!isCircleIntersecting(playerBoundingCircle, possibleIntersectors)) {
        return playerPosition;
      }

      rotation += Math.PI / 8;
      radius += 30;
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
          vec2.normalize(
            vec2.create(),
            vec2.subtract(vec2.create(), p.center, this.character!.center),
          ),
          p.team,
        ),
    );
  }

  private sendToPlayer(command: Command) {
    this.socket.emit(TransportEvents.ServerToPlayer, serialize(command));
  }

  public destroy() {
    this.isActive = false;
    this.character?.destroy();
  }
}
