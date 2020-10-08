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
  last,
  Circle,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { Physical } from '../physics/physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Spring } from './spring';

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
  private lastMovementAction: MoveActionCommand = new MoveActionCommand(vec2.create());

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.step.bind(this),
    [MoveActionCommand.type]: (c: MoveActionCommand) => this.movementActions.push(c),
  };

  private static readonly headOffset = vec2.fromValues(0, 40);
  private static readonly leftFootOffset = vec2.fromValues(-20, -35);
  private static readonly rightFootOffset = vec2.fromValues(20, -35);

  constructor(private readonly container: PhysicalContainer) {
    super(id());
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

  public get center(): vec2 {
    return this.head.center;
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

  public step(c: StepCommand) {
    const deltaTime = c.deltaTimeInMiliseconds / 1000;

    const direction = this.sumAndResetMovementActions();
    const isAirborne = this.leftFoot.isAirborne && this.rightFoot.isAirborne;
    this.jumpEnergyLeft += isAirborne ? -deltaTime : deltaTime;
    this.jumpEnergyLeft = clamp(this.jumpEnergyLeft, 0, settings.defaultJumpEnergy);

    const xMax = deltaTime * settings.maxAccelerationX;
    const yMax = this.jumpEnergyLeft > 0 ? settings.maxAccelerationY : 0;
    const movementForce = vec2.multiply(
      direction,
      direction,
      vec2.fromValues(xMax, yMax),
    );

    const sumBody = vec2.add(vec2.create(), this.head.center, this.leftFoot.center);
    vec2.add(sumBody, sumBody, this.rightFoot.center);
    vec2.scale(sumBody, sumBody, 1 / 3);

    const headPosition = vec2.add(vec2.create(), sumBody, CharacterPhysical.headOffset);

    Spring.step(new Circle(headPosition, 0), this.head, 0, 30, deltaTime);

    const footDistance = vec2.distance(
      CharacterPhysical.headOffset,
      CharacterPhysical.leftFootOffset,
    );

    Spring.step(
      new Circle(this.head.center, this.head.radius),
      this.leftFoot,
      footDistance,
      25,
      deltaTime,
    );
    Spring.step(
      new Circle(this.head.center, this.head.radius),
      this.rightFoot,
      footDistance,
      25,
      deltaTime,
    );
    Spring.step(
      this.leftFoot,
      this.rightFoot,
      vec2.distance(CharacterPhysical.leftFootOffset, CharacterPhysical.rightFootOffset),
      100,
      deltaTime,
    );

    this.head.applyForce(movementForce, deltaTime);
    this.leftFoot.applyForce(movementForce, deltaTime);
    this.rightFoot.applyForce(movementForce, deltaTime);

    this.head.applyForce(settings.gravitationalForce, deltaTime);
    this.leftFoot.applyForce(settings.gravitationalForce, deltaTime);
    this.rightFoot.applyForce(settings.gravitationalForce, deltaTime);

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
