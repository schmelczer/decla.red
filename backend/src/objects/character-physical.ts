import { vec2 } from 'gl-matrix';
import {
  id,
  CharacterBase,
  StepCommand,
  settings,
  CommandExecutors,
  MoveActionCommand,
  serializesTo,
  clamp,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { Physical } from '../physics/physical';
import { PhysicalContainer } from '../physics/containers/physical-container';

@serializesTo(CharacterBase)
export class CharacterPhysical extends CharacterBase implements Physical {
  public readonly canCollide = true;
  public readonly isInverted = false;
  public readonly canMove = true;

  private jumpEnergyLeft = settings.defaultJumpEnergy;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;

  private movementActions: Array<MoveActionCommand> = [];

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.step.bind(this),
    [MoveActionCommand.type]: (c: MoveActionCommand) => this.movementActions.push(c),
  };

  private static readonly headOffset = vec2.fromValues(0, 40);
  private static readonly leftFootOffset = vec2.fromValues(-20, -10);
  private static readonly rightFootOffset = vec2.fromValues(20, -10);

  constructor(private readonly container: PhysicalContainer) {
    super(id(), undefined, undefined, undefined);
    this.head = new CirclePhysical(
      vec2.clone(CharacterPhysical.headOffset),
      50,
      this,
      container,
    );
    this.leftFoot = new CirclePhysical(
      vec2.clone(CharacterPhysical.leftFootOffset),
      20,
      this,
      container,
    );
    this.rightFoot = new CirclePhysical(
      vec2.clone(CharacterPhysical.rightFootOffset),
      20,
      this,
      container,
    );
    container.addObject(this.head);
    container.addObject(this.leftFoot);
    container.addObject(this.rightFoot);
  }

  private _boundingBox?: ImmutableBoundingBox;

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      this._boundingBox = (this.head as CirclePhysical).boundingBox;
    }

    return this._boundingBox;
  }

  public get gameObject(): CharacterPhysical {
    return this;
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
    if (this.movementActions.length === 0) {
      return vec2.create();
    }

    const movementForce = this.movementActions.reduce(
      (sum, current) => vec2.add(sum, sum, current.delta),
      vec2.create(),
    );

    vec2.scale(movementForce, movementForce, 1 / this.movementActions.length);

    this.movementActions = [];

    return movementForce;
  }

  public step(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds;

    this.head.applyForce(settings.gravitationalForce, deltaTime);
    this.leftFoot.applyForce(settings.gravitationalForce, deltaTime);
    this.rightFoot.applyForce(settings.gravitationalForce, deltaTime);

    const movementForce = this.sumAndResetMovementActions();

    const isAirborne = this.leftFoot.isAirborne && this.rightFoot.isAirborne;
    if (isAirborne) {
      this.jumpEnergyLeft -= deltaTime;
    } else {
      this.jumpEnergyLeft = settings.defaultJumpEnergy;
    }
    const xMax = deltaTime * settings.maxAccelerationX;
    const yMax = this.jumpEnergyLeft > 0 ? deltaTime * settings.maxAccelerationY : 0;

    vec2.set(
      movementForce,
      clamp(movementForce.x, -xMax, xMax),
      clamp(movementForce.y, -yMax, yMax),
    );

    this.head.applyForce(movementForce, deltaTime);
    this.leftFoot.applyForce(movementForce, deltaTime);
    this.rightFoot.applyForce(movementForce, deltaTime);

    const bodyCenter = vec2.subtract(
      vec2.create(),
      this.head.center,
      CharacterPhysical.headOffset,
    );

    const leftFootPositon = vec2.add(
      vec2.create(),
      bodyCenter,
      CharacterPhysical.leftFootOffset,
    );
    const rightFootPositon = vec2.add(
      vec2.create(),
      bodyCenter,
      CharacterPhysical.rightFootOffset,
    );

    const leftFootDelta = vec2.subtract(
      vec2.create(),
      this.leftFoot.center,
      leftFootPositon,
    );

    const rightFootDelta = vec2.subtract(
      vec2.create(),
      this.rightFoot.center,
      rightFootPositon,
    );

    if (vec2.squaredLength(leftFootDelta) > 0) {
      vec2.scale(leftFootDelta, leftFootDelta, 0.001);
      this.head.applyForce(leftFootDelta, deltaTime);
      vec2.scale(leftFootDelta, leftFootDelta, -4);
      this.leftFoot.applyForce(leftFootDelta, deltaTime);
    }

    if (vec2.squaredLength(rightFootDelta) > 0) {
      vec2.scale(rightFootDelta, rightFootDelta, 0.001);
      this.head.applyForce(rightFootDelta, deltaTime);
      vec2.scale(rightFootDelta, rightFootDelta, -4);
      this.rightFoot.applyForce(rightFootDelta, deltaTime);
    }

    this.head.step(deltaTime);
    this.leftFoot.step(deltaTime);
    this.rightFoot.step(deltaTime);
  }

  public destroy() {
    this.container.removeObject(this.head);
    this.container.removeObject(this.leftFoot);
    this.container.removeObject(this.rightFoot);
  }
}
