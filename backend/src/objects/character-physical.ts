import { vec2 } from 'gl-matrix';
import {
  id,
  CharacterBase,
  settings,
  MoveActionCommand,
  serializesTo,
  clamp,
  last,
  GameObject,
  Circle,
} from 'shared';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { CirclePhysical } from './circle-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { ProjectilePhysical } from './projectile-physical';
import { interpolateAngles } from '../helper/interpolate-angles';
import { forceAtPosition } from '../physics/functions/force-at-position';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { PlanetPhysical } from './planet-physical';
import { ReactsToCollision } from '../physics/physicals/reacts-to-collision';

@serializesTo(CharacterBase)
export class CharacterPhysical
  extends CharacterBase
  implements DynamicPhysical, ReactsToCollision {
  public readonly canCollide = true;
  public readonly canMove = true;

  private static readonly headRadius = 50;
  private static readonly feetRadius = 20;
  // offsets are meassured from (0, 0)
  private static readonly desiredHeadOffset = vec2.fromValues(0, 65);
  private static readonly desiredLeftFootOffset = vec2.fromValues(-20, 0);
  private static readonly desiredRightFootOffset = vec2.fromValues(20, 0);
  private static readonly centerOfMass = vec2.scale(
    vec2.create(),
    vec2.add(
      vec2.create(),
      vec2.add(
        vec2.create(),
        CharacterPhysical.desiredHeadOffset,
        CharacterPhysical.desiredLeftFootOffset,
      ),
      CharacterPhysical.desiredRightFootOffset,
    ),
    1 / 3,
  );

  private static readonly headOffset = vec2.subtract(
    vec2.create(),
    CharacterPhysical.desiredHeadOffset,
    CharacterPhysical.centerOfMass,
  );
  private static readonly leftFootOffset = vec2.subtract(
    vec2.create(),
    CharacterPhysical.desiredLeftFootOffset,
    CharacterPhysical.centerOfMass,
  );
  private static readonly rightFootOffset = vec2.subtract(
    vec2.create(),
    CharacterPhysical.desiredRightFootOffset,
    CharacterPhysical.centerOfMass,
  );

  public static readonly boundRadius =
    (CharacterPhysical.headRadius + CharacterPhysical.feetRadius * 2) * 2;

  private isDestroyed = false;
  private direction = 0;
  private currentPlanet?: PlanetPhysical;
  private lastMovementWasRelative = false;
  private secondsSinceOnSurface = 1000;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;
  public bound: CirclePhysical;

  private movementActions: Array<MoveActionCommand> = [];
  private lastMovementAction: MoveActionCommand = new MoveActionCommand(
    vec2.create(),
    false,
  );

  constructor(
    public readonly colorIndex: number,
    private readonly container: PhysicalContainer,
    startPosition: vec2,
  ) {
    super(id(), colorIndex);
    this.head = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, CharacterPhysical.headOffset),
      CharacterPhysical.headRadius,
      this,
      container,
    );
    this.leftFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, CharacterPhysical.leftFootOffset),
      CharacterPhysical.feetRadius,
      this,
      container,
    );
    this.rightFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, CharacterPhysical.rightFootOffset),
      CharacterPhysical.feetRadius,
      this,
      container,
    );
    container.addObject(this.head);
    container.addObject(this.leftFoot);
    container.addObject(this.rightFoot);

    this.bound = new CirclePhysical(
      vec2.create(),
      CharacterPhysical.boundRadius,
      this,
      container,
    );
  }

  public handleMovementAction(c: MoveActionCommand) {
    this.movementActions.push(c);
  }

  public onCollision(other: GameObject) {
    if (other instanceof ProjectilePhysical) {
      other.destroy();
      this.destroy();
    }
  }

  public get boundingBox(): BoundingBoxBase {
    this.bound.center = this.head.center;
    return this.bound.boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public get center(): vec2 {
    return this.head.center;
  }

  public get velocity(): vec2 {
    return this.head.velocity;
  }

  public distance(target: vec2): number {
    return (
      Math.min(
        this.head.distance(target),
        this.leftFoot.distance(target),
        this.rightFoot.distance(target),
      ) - 20
    );
  }

  private averageAndResetMovementActions(): vec2 {
    let direction: vec2;
    if (this.movementActions.length === 0) {
      direction = vec2.clone(this.lastMovementAction.direction);
    } else {
      direction = this.movementActions.reduce(
        (sum, current) => vec2.add(sum, sum, current.direction),
        vec2.create(),
      );

      vec2.scale(direction, direction, 1 / this.movementActions.length);

      this.lastMovementWasRelative =
        this.movementActions.find((a) => a.isCharacterRelative) !== undefined;

      this.lastMovementAction = last(this.movementActions)!;
      this.movementActions = [];
    }

    return direction;
  }

  public step(deltaTime: number) {
    if ((this.secondsSinceOnSurface += deltaTime) > 1) {
      this.currentPlanet = undefined;
    }

    const intersectingWithForcefield = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(
          this.center,
          CharacterPhysical.boundRadius + settings.maxGravityDistance,
        ),
      ),
    );
    const actualGravity = forceAtPosition(this.center, intersectingWithForcefield);

    const direction = this.averageAndResetMovementActions();
    const movementForce = vec2.scale(direction, direction, settings.maxAcceleration);

    if (!this.currentPlanet) {
      this.applyForce(this.leftFoot, actualGravity, deltaTime);
      this.applyForce(this.rightFoot, actualGravity, deltaTime);

      const sumForce = vec2.subtract(vec2.create(), actualGravity, movementForce);

      this.setDirection(
        vec2.length(sumForce) === 0 ? vec2.fromValues(0, -1) : sumForce,
        deltaTime,
      );
    } else {
      const leftFootGravity = this.currentPlanet!.getForce(this.leftFoot.center);
      const rightFootGravity = this.currentPlanet!.getForce(this.rightFoot.center);
      if (movementForce.y > settings.maxAcceleration / 4) {
        vec2.scale(leftFootGravity, leftFootGravity, 0.35);
        vec2.scale(rightFootGravity, rightFootGravity, 0.35);
      }
      this.applyForce(this.leftFoot, leftFootGravity, deltaTime);
      this.applyForce(this.rightFoot, rightFootGravity, deltaTime);

      if (this.lastMovementWasRelative) {
        vec2.rotate(movementForce, movementForce, vec2.create(), this.direction);
      }

      const headGravity = this.currentPlanet!.getForce(this.head.center);

      if (vec2.length(headGravity) < vec2.length(actualGravity) / 2) {
        this.currentPlanet = undefined;
      }
      this.setDirection(headGravity, deltaTime);
    }

    this.applyForce(this.leftFoot, movementForce, deltaTime);
    this.applyForce(this.rightFoot, movementForce, deltaTime);

    this.stepBodyPart(this.leftFoot, deltaTime);
    this.stepBodyPart(this.rightFoot, deltaTime);
    this.keepPosture();
  }

  private setDirection(direction: vec2, deltaTime: number) {
    this.direction = interpolateAngles(
      this.direction,
      Math.atan2(direction.y, direction.x) + Math.PI / 2,
      Math.pow(4, deltaTime),
    );
  }

  private keepPosture() {
    const bodyCenter = vec2.add(vec2.create(), this.head.center, this.leftFoot.center);
    vec2.add(bodyCenter, bodyCenter, this.rightFoot.center);
    vec2.scale(bodyCenter, bodyCenter, 1 / 3);
    this.springMove(this.leftFoot, bodyCenter, CharacterPhysical.leftFootOffset);
    this.springMove(this.rightFoot, bodyCenter, CharacterPhysical.rightFootOffset);
    this.springMove(this.head, bodyCenter, CharacterPhysical.headOffset);
  }

  private springMove(object: CirclePhysical, center: vec2, offset: vec2) {
    // todo: make time-independent
    const springConstant = 0.35;

    const desiredPosition = vec2.add(vec2.create(), center, offset);
    vec2.rotate(desiredPosition, desiredPosition, center, this.direction);
    const positionDelta = vec2.subtract(desiredPosition, desiredPosition, object.center);
    vec2.scale(positionDelta, positionDelta, springConstant);
    const hitObject = object.tryMove(positionDelta);

    if (hitObject instanceof PlanetPhysical) {
      this.secondsSinceOnSurface = 0;
      this.currentPlanet = hitObject;
    }
  }

  private stepBodyPart(part: CirclePhysical, deltaTime: number) {
    const hitObject = part.step2(deltaTime);

    if (hitObject instanceof PlanetPhysical) {
      this.secondsSinceOnSurface = 0;
      this.currentPlanet = hitObject;
    }
  }

  public applyForce(circle: CirclePhysical, force: vec2, timeInSeconds: number) {
    vec2.add(
      circle.velocity,
      circle.velocity,
      vec2.scale(vec2.create(), force, timeInSeconds),
    );

    vec2.set(
      circle.velocity,
      clamp(circle.velocity.x, -settings.maxVelocityX, settings.maxVelocityX),
      clamp(circle.velocity.y, -settings.maxVelocityY, settings.maxVelocityY),
    );
  }

  public destroy() {
    if (!this.isDestroyed) {
      this.isDestroyed = true;
      this.container.removeObject(this);
      this.container.removeObject(this.head);
      this.container.removeObject(this.leftFoot);
      this.container.removeObject(this.rightFoot);
    }
  }
}
