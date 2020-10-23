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
  UpdateObjectsCommand,
  SetAspectRatioActionCommand,
  calculateViewArea,
  SecondaryActionCommand,
  PlayerDiedCommand,
  settings,
  Circle,
  PlayerInformation,
  CharacterTeam,
  UpdateGameState,
  GameObject,
  Command,
  UpdateObjectMessage,
  OtherPlayerDirection,
} from 'shared';
import { getTimeInMilliseconds } from '../helper/get-time-in-milliseconds';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { freeTeam, requestTeam } from './player-team-service';
import { PlanetPhysical } from '../objects/planet-physical';

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

  private findEmptyPositionForPlayer(): vec2 {
    let possibleCenter = this.players.find(
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
      const possibleIntersectors = this.objects.findIntersecting(playerBoundingBox);
      if (!isCircleIntersecting(playerBoundingCircle, possibleIntersectors)) {
        return playerPosition;
      }

      rotation += Math.PI / 8;
      radius += 30;
    }
  }

  public readonly team: CharacterTeam;
  private colorIndex: number;

  constructor(
    private readonly playerInfo: PlayerInformation,
    private readonly players: Array<Player>,
    private readonly objects: PhysicalContainer,
    private readonly socket: SocketIO.Socket,
  ) {
    super();
    const { team, colorIndex } = requestTeam();
    this.team = team;
    this.colorIndex = colorIndex;

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
      this.colorIndex,
      this.team,
      this.objects,
      this.findEmptyPositionForPlayer(),
    );

    this.objects.addObject(this.character);
    this.objectsPreviouslyInViewArea.push(this.character);

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(new CreatePlayerCommand(this.character)),
    );
  }

  private center: vec2 = vec2.create();
  private timeUntilRespawn = 0;
  public step(deltaTime: number) {
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
    } else if ((this.timeUntilRespawn -= deltaTime) < 0) {
      this.createCharacter();
    }

    const viewArea = calculateViewArea(this.center, this.aspectRatio, 1.5);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const objectsInViewArea = Array.from(
      new Set(this.objects.findIntersecting(bb).map((o) => o.gameObject)),
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
      new UpdateObjectsCommand(
        this.objectsPreviouslyInViewArea
          .map((g) => g.calculateUpdates())
          .filter((u) => u) as Array<UpdateObjectMessage>,
      ),
    );

    this.sendToPlayer(
      new UpdateGameState(
        PlanetPhysical.declaPlanetCount,
        PlanetPhysical.redPlanetCount,
        PlanetPhysical.neutralPlanetCount,
        this.getOtherPlayers(),
      ),
    );
  }

  private getOtherPlayers(): Array<OtherPlayerDirection> {
    if (!this.character) {
      return [];
    }

    const viewArea = calculateViewArea(this.center, this.aspectRatio, 0.9);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    const playersInViewArea = this.objects
      .findIntersecting(bb)
      .map((o) => o.gameObject)
      .filter((g) => g instanceof PlayerCharacterPhysical);

    const otherPlayers = this.players.filter(
      (p) => playersInViewArea.indexOf(p.character!) < 0,
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
    freeTeam(this.team);

    if (this.character) {
      this.character.destroy();
    }
  }
}
