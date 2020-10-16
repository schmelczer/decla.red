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
} from 'shared';
import { getTimeInMilliseconds } from '../helper/get-time-in-milliseconds';
import { CharacterPhysical } from '../objects/character-physical';
import { ProjectilePhysical } from '../objects/projectile-physical';

import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PhysicalBase } from '../physics/physicals/physical-base';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { requestColor, freeColor } from './player-color-service';

export class Player extends CommandReceiver {
  private character: CharacterPhysical;
  private aspectRatio: number = 16 / 9;
  private isActive = true;

  private timeSinceLastProjectile = 0;

  private objectsPreviouslyInViewArea: Array<PhysicalBase> = [];
  private objectsInViewArea: Array<PhysicalBase> = [];

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
      if (this.timeSinceLastProjectile < settings.projectileCreationInterval) {
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
        CharacterPhysical.boundRadius,
      );

      const playerBoundingBox = getBoundingBoxOfCircle(playerBoundingCircle);
      const possibleIntersectors = this.objects.findIntersecting(playerBoundingBox);
      if (!isCircleIntersecting(playerBoundingCircle, possibleIntersectors)) {
        return playerPosition;
      }

      rotation += Math.PI / 12;
      radius += 10;
    }
  }

  constructor(
    private readonly objects: PhysicalContainer,
    private readonly socket: SocketIO.Socket,
  ) {
    super();
    const colorIndex = requestColor();

    this.character = new CharacterPhysical(
      colorIndex,
      objects,
      this.findEmptyPositionForPlayer(),
    );

    this.objectsPreviouslyInViewArea.push(this.character);
    this.objectsInViewArea.push(this.character);

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
            ...new Set(noLongerIntersecting.map((p) => p.gameObject.id)),
          ]),
        ),
      );
    }

    if (newlyIntersecting.length > 0) {
      this.socket.emit(
        TransportEvents.ServerToPlayer,
        serialize(
          new CreateObjectsCommand([
            ...new Set(newlyIntersecting.map((p) => p.gameObject)),
          ]),
        ),
      );
    }

    this.socket.volatile.emit(
      TransportEvents.ServerToPlayer,
      serialize(
        new UpdateObjectsCommand([
          ...new Set(
            this.objectsInViewArea.filter((p) => p.canMove).map((p) => p.gameObject),
          ),
        ]),
      ),
    );
  }

  public destroy() {
    this.isActive = false;
    freeColor(this.character.colorIndex);
    this.character.destroy();
  }
}
