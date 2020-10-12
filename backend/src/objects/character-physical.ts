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
} from 'shared';
import { DynamicPhysical } from '../physics/conatiners/dynamic-physical';
import { CirclePhysical } from './circle-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Spring } from './spring';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { ProjectilePhysical } from './projectile-physical';

@serializesTo(CharacterBase)
export class CharacterPhysical extends CharacterBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;
  private isDestroyed = false;
  private jumpEnergyLeft = settings.defaultJumpEnergy;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;
  public bound: CirclePhysical;

  private movementActions: Array<MoveActionCommand> = [];
  private lastMovementAction: MoveActionCommand = new MoveActionCommand(vec2.create());

  public handleMovementAction(c: MoveActionCommand) {
    this.movementActions.push(c);
  }

  private static readonly headOffset = vec2.fromValues(0, 40);
  private static readonly headRadius = 50;
  private static readonly feetRadius = 20;
  private static readonly leftFootOffset = vec2.fromValues(-20, -35);
  private static readonly rightFootOffset = vec2.fromValues(20, -35);

  constructor(
    public readonly colorIndex: number,
    private readonly container: PhysicalContainer,
  ) {
    super(id(), colorIndex);
    this.head = new CirclePhysical(
      vec2.clone(CharacterPhysical.headOffset),
      CharacterPhysical.headRadius,
      this,
      container,
    );
    this.leftFoot = new CirclePhysical(
      vec2.clone(CharacterPhysical.leftFootOffset),
      CharacterPhysical.feetRadius,
      this,
      container,
    );
    this.rightFoot = new CirclePhysical(
      vec2.clone(CharacterPhysical.rightFootOffset),
      CharacterPhysical.feetRadius,
      this,
      container,
    );
    container.addObject(this.head);
    container.addObject(this.leftFoot);
    container.addObject(this.rightFoot);

    this.bound = new CirclePhysical(
      vec2.create(),
      (CharacterPhysical.headRadius + CharacterPhysical.feetRadius * 2) * 2,
      this,
      container,
    );
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

  private sumAndResetMovementActions(): vec2 {
    let direction: vec2;
    if (this.movementActions.length === 0) {
      direction = vec2.clone(this.lastMovementAction.direction);
    } else {
      direction = this.movementActions.reduce(
        (sum, current) => vec2.add(sum, sum, current.direction),
        vec2.create(),
      );

      vec2.scale(direction, direction, 1 / this.movementActions.length);

      this.lastMovementAction = last(this.movementActions)!;
      this.movementActions = [];
    }

    return direction;
  }

  public step(deltaTimeInMiliseconds: number) {
    const deltaTime = deltaTimeInMiliseconds / 1000;
    const direction = this.sumAndResetMovementActions();
    const feetAirborne = this.leftFoot.isAirborne && this.rightFoot.isAirborne;
    const isAirborne = feetAirborne && this.head.isAirborne;
    this.jumpEnergyLeft += isAirborne ? -deltaTime : deltaTime;
    this.jumpEnergyLeft = clamp(this.jumpEnergyLeft, 0, settings.defaultJumpEnergy);

    const xMax = deltaTime * settings.maxAccelerationX;
    const yMax = this.jumpEnergyLeft > 0 ? settings.maxAccelerationY : 0;
    const movementForce = vec2.multiply(
      direction,
      direction,
      vec2.fromValues(xMax, yMax),
    );

    Spring.step(
      this.leftFoot,
      this.rightFoot,
      vec2.distance(CharacterPhysical.leftFootOffset, CharacterPhysical.rightFootOffset),
      300,
      deltaTime,
    );

    this.applyForce(this.head, movementForce, deltaTime);
    this.applyForce(this.leftFoot, movementForce, deltaTime);
    this.applyForce(this.rightFoot, movementForce, deltaTime);

    if (feetAirborne) {
      this.applyForce(this.head, settings.gravitationalForce, deltaTime);
    }
    this.applyForce(this.leftFoot, settings.gravitationalForce, deltaTime);
    this.applyForce(this.rightFoot, settings.gravitationalForce, deltaTime);

    this.head.step2(deltaTime);
    this.leftFoot.step2(deltaTime);
    this.rightFoot.step2(deltaTime);

    let sumBody = vec2.add(vec2.create(), this.head.center, this.leftFoot.center);
    vec2.add(sumBody, sumBody, this.rightFoot.center);
    vec2.scale(sumBody, sumBody, 1 / 3);

    const headPosition = vec2.add(vec2.create(), sumBody, CharacterPhysical.headOffset);
    const headDelta = vec2.subtract(headPosition, headPosition, this.head.center);
    vec2.scale(headDelta, headDelta, 0.5);
    this.head.tryMove(headDelta);

    sumBody = vec2.add(vec2.create(), this.head.center, this.leftFoot.center);
    vec2.add(sumBody, sumBody, this.rightFoot.center);
    vec2.scale(sumBody, sumBody, 1 / 3);

    const leftFootPosition = vec2.add(
      vec2.create(),
      sumBody,
      CharacterPhysical.leftFootOffset,
    );
    const leftFootDelta = vec2.subtract(
      leftFootPosition,
      leftFootPosition,
      this.leftFoot.center,
    );
    vec2.scale(leftFootDelta, leftFootDelta, 1);
    this.leftFoot.tryMove(leftFootDelta);

    const rightFootPosition = vec2.add(
      vec2.create(),
      sumBody,
      CharacterPhysical.rightFootOffset,
    );
    const rightFootDelta = vec2.subtract(
      rightFootPosition,
      rightFootPosition,
      this.rightFoot.center,
    );
    vec2.scale(rightFootDelta, rightFootDelta, 1);
    this.rightFoot.tryMove(rightFootDelta);
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
