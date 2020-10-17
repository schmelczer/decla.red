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
  settings,
  Circle,
  PlayerInformation,
} from 'shared';
import { getTimeInMilliseconds } from '../helper/get-time-in-milliseconds';
import { ProjectilePhysical } from '../objects/projectile-physical';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { requestColor, freeColor } from './player-color-service';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { Physical } from '../physics/physicals/physical';

export class Player extends CommandReceiver {
  private character: PlayerCharacterPhysical;
  private aspectRatio: number = 16 / 9;
  private isActive = true;

  private timeSinceLastProjectile = 0;

  private objectsPreviouslyInViewArea: Array<Physical> = [];
  private objectsInViewArea: Array<Physical> = [];

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
      this.character.handleMovementAction(c),
    [SecondaryActionCommand.type]: (c: SecondaryActionCommand) => {
      if (
        !this.character.isAlive ||
        this.timeSinceLastProjectile < settings.projectileCreationInterval
      ) {
        return;
      }

      const start = vec2.clone(this.character.center);
      const direction = vec2.subtract(vec2.create(), c.position, start);
      vec2.normalize(direction, direction);
      vec2.add(
        start,
        start,
        vec2.scale(vec2.create(), direction, settings.projectileStartOffset),
      );
      const velocity = vec2.scale(direction, direction, settings.projectileSpeed);
      vec2.add(velocity, velocity, this.character.velocity);
      const projectile = new ProjectilePhysical(start, 20, velocity, this.objects);
      this.objects.addObject(projectile);

      this.timeSinceLastProjectile = 0;
    },
  };

  private findEmptyPositionForPlayer(): vec2 {
    let rotation = 0;
    let radius = 0;
    for (;;) {
      const playerPosition = vec2.fromValues(
        radius * Math.cos(rotation),
        radius * Math.sin(rotation),
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

  constructor(
    playerInfo: PlayerInformation,
    private readonly objects: PhysicalContainer,
    private readonly socket: SocketIO.Socket,
  ) {
    super();
    const colorIndex = requestColor();

    this.character = new PlayerCharacterPhysical(
      playerInfo.name,
      colorIndex,
      objects,
      this.findEmptyPositionForPlayer(),
    );

    this.objects.addObject(this.character);

    socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(new CreatePlayerCommand(this.character)),
    );

    socket.on(
      TransportEvents.Pong,
      () => (this._latency = getTimeInMilliseconds() - this.pingTime!),
    );

    this.measureLatency();
    this.sendObjects();
  }

  public step(deltaTime: number) {
    this.sendObjects();
    this.timeSinceLastProjectile += deltaTime;
  }

  public sendObjects() {
    const viewArea = calculateViewArea(this.character.center, this.aspectRatio, 1.5);
    const bb = new BoundingBox();
    bb.topLeft = viewArea.topLeft;
    bb.size = viewArea.size;

    this.objectsInViewArea = this.objects.findIntersecting(bb);

    const newlyIntersecting = this.objectsInViewArea.filter(
      (o) => !this.objectsPreviouslyInViewArea.includes(o),
    );

    const noLongerIntersecting = this.objectsPreviouslyInViewArea.filter(
      (o) => !this.objectsInViewArea.includes(o),
    );

    this.objectsPreviouslyInViewArea = this.objectsInViewArea;

    if (noLongerIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        serialize(
          new DeleteObjectsCommand([
            ...new Set(
              noLongerIntersecting
                .filter((p) => p.gameObject !== this.character)
                .map((p) => p.gameObject.id),
            ),
          ]),
        ),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        serialize(
          new CreateObjectsCommand([
            ...new Set(
              newlyIntersecting
                .map((p) => p.gameObject)
                .filter((g) => g !== this.character),
            ),
          ]),
        ),
      );
    }

    this.socket.emit(
      TransportEvents.ServerToPlayer,
      serialize(
        new UpdateObjectsCommand(
          Array.from(new Set(this.objectsInViewArea))
            .filter((p) => p.canMove)
            .map((p) => (p as DynamicPhysical).calculateUpdates())
            .filter((p) => p !== null) as any,
        ),
      ),
    );
  }

  public destroy() {
    this.isActive = false;
    freeColor(this.character.colorIndex);
    this.character.destroy();
  }
}
