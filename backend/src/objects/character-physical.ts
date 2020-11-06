import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  MoveActionCommand,
  serializesTo,
  last,
  GameObject,
  Circle,
  CharacterBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CommandExecutors,
  CommandReceiver,
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
import { StepCommand } from '../commands/step';
import { ReactToCollisionCommand } from '../commands/react-to-collision';
import { GeneratePointsCommand } from '../commands/generate-points';

@serializesTo(CharacterBase)
export class CharacterPhysical extends CharacterBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;

  private static readonly headRadius = 50;
  private static readonly feetRadius = 20;
  private projectileStrength = settings.playerMaxStrength;

  // offsets are measured from (0, 0)
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

  private timeSinceDying = 0;
  private isDestroyed = false;
  private timeSinceBorn = 0;
  private hasJustBorn = true;

  private direction = 0;
  private currentPlanet?: PlanetPhysical;
  private secondsSinceOnSurface = 1000;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;
  public bound: CirclePhysical;

  private movementActions: Array<MoveActionCommand> = [];
  private lastMovementAction: MoveActionCommand = new MoveActionCommand(vec2.create());

  private headVelocity = new Circle(vec2.create(), 0);
  private leftFootVelocity = new Circle(vec2.create(), 0);
  private rightFootVelocity = new Circle(vec2.create(), 0);

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.step.bind(this),
    [ReactToCollisionCommand.type]: this.onCollision.bind(this),
  };

  constructor(
    name: string,
    killCount: number,
    deathCount: number,
    team: CharacterTeam,
    private readonly container: PhysicalContainer,
    startPosition: vec2,
  ) {
    super(id(), name, killCount, deathCount, team, settings.playerMaxHealth);
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

  private hasGeneratedPoints = false;
  private getPoints(game: CommandReceiver) {
    if (!this.isAlive && !this.hasGeneratedPoints) {
      this.hasGeneratedPoints = true;
      const decla = this.team === CharacterTeam.decla ? 0 : settings.playerKillPoint;
      const red = this.team === CharacterTeam.red ? 0 : settings.playerKillPoint;

      game.handleCommand(new GeneratePointsCommand(decla, red));
    }
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  public handleMovementAction(c: MoveActionCommand) {
    this.movementActions.push(c);
  }

  public addKill() {
    this.killCount++;
    this.remoteCall('setKillCount', this.killCount);
  }

  public onCollision({ other }: ReactToCollisionCommand) {
    if (
      other instanceof ProjectilePhysical &&
      other.team !== this.team &&
      other.isAlive
    ) {
      other.destroy();
      this.health -= other.strength;
      this.remoteCall('setHealth', this.health);
      if (this.health <= 0 && this.isAlive) {
        this.onDie();
        other.originator.addKill();
      }
    }
  }

  public shootTowards(position: vec2) {
    if (!this.isAlive) {
      return;
    }

    const direction = vec2.subtract(vec2.create(), position, this.center);
    vec2.normalize(direction, direction);
    const velocity = vec2.scale(direction, direction, settings.projectileSpeed);
    const strength = this.projectileStrength / 2;
    this.projectileStrength -= strength;
    const projectile = new ProjectilePhysical(
      vec2.clone(this.center),
      20,
      strength,
      this.team,
      velocity,
      this,
      this.container,
    );
    this.container.addObject(projectile);

    this.remoteCall('onShoot', strength);
  }

  public get boundingBox(): BoundingBoxBase {
    this.bound.center = this.head.center;
    return this.bound.boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public get center(): vec2 {
    const bodyCenter = vec2.add(vec2.create(), this.head.center, this.leftFoot.center);
    vec2.add(bodyCenter, bodyCenter, this.rightFoot.center);
    return vec2.scale(bodyCenter, bodyCenter, 1 / 3);
  }

  public distance(target: vec2): number {
    return (
      Math.min(
        this.head.distance(target),
        this.leftFoot.distance(target),
        this.rightFoot.distance(target),
      ) - 5
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

      this.lastMovementAction = last(this.movementActions)!;
      this.movementActions = [];
    }

    return vec2.length(direction) > 0
      ? vec2.normalize(direction, direction)
      : vec2.create();
  }

  private animateScaling(q: number) {
    this.head.radius = CharacterPhysical.headRadius * q;
    this.leftFoot.radius = this.rightFoot.radius = CharacterPhysical.feetRadius * q;
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('head', this.head, this.headVelocity),
      new UpdatePropertyCommand('leftFoot', this.leftFoot, this.leftFootVelocity),
      new UpdatePropertyCommand('rightFoot', this.rightFoot, this.rightFootVelocity),
    ]);
  }

  private setPropertyUpdates(
    oldHead: Circle,
    oldLeftFoot: Circle,
    oldRightFoot: Circle,
    deltaTime: number,
  ) {
    this.headVelocity = new Circle(
      vec2.scale(
        oldHead.center,
        vec2.subtract(oldHead.center, this.head.center, oldHead.center),
        1 / deltaTime,
      ),
      (this.head.radius - oldHead.radius) / deltaTime,
    );

    this.leftFootVelocity = new Circle(
      vec2.scale(
        oldLeftFoot.center,
        vec2.subtract(oldLeftFoot.center, this.leftFoot.center, oldLeftFoot.center),
        1 / deltaTime,
      ),
      (this.leftFoot.radius - oldLeftFoot.radius) / deltaTime,
    );

    this.rightFootVelocity = new Circle(
      vec2.scale(
        oldRightFoot.center,
        vec2.subtract(oldRightFoot.center, this.rightFoot.center, oldRightFoot.center),
        1 / deltaTime,
      ),
      (this.rightFoot.radius - oldRightFoot.radius) / deltaTime,
    );

    this.animateScaling(1);
  }

  private step({ deltaTimeInSeconds, game }: StepCommand) {
    this.getPoints(game);
    const oldHead = new Circle(vec2.clone(this.head.center), this.head.radius);
    const oldLeftFoot = new Circle(
      vec2.clone(this.leftFoot.center),
      this.leftFoot.radius,
    );
    const oldRightFoot = new Circle(
      vec2.clone(this.rightFoot.center),
      this.rightFoot.radius,
    );

    if (this.isDestroyed) {
      if ((this.timeSinceDying += deltaTimeInSeconds) > settings.spawnDespawnTime) {
        this.destroy();
      } else {
        this.animateScaling(1 - this.timeSinceDying / settings.spawnDespawnTime);
      }
      this.setPropertyUpdates(oldHead, oldLeftFoot, oldRightFoot, deltaTimeInSeconds);
      return;
    }

    if (this.hasJustBorn) {
      if ((this.timeSinceBorn += deltaTimeInSeconds) > settings.spawnDespawnTime) {
        this.hasJustBorn = false;
      } else {
        this.animateScaling(this.timeSinceBorn / settings.spawnDespawnTime);
      }
      this.setPropertyUpdates(oldHead, oldLeftFoot, oldRightFoot, deltaTimeInSeconds);
      return;
    }

    if ((this.secondsSinceOnSurface += deltaTimeInSeconds) > 0.5) {
      this.currentPlanet = undefined;
    }

    this.projectileStrength = Math.min(
      settings.playerMaxStrength,
      this.projectileStrength +
        settings.playerStrengthRegenerationPerSeconds * deltaTimeInSeconds,
    );

    this.currentPlanet?.takeControl(this.team, deltaTimeInSeconds);

    const intersectingWithForceField = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(
          this.center,
          CharacterPhysical.boundRadius + settings.maxGravityDistance,
        ),
      ),
    );

    const direction = this.averageAndResetMovementActions();
    const movementForce = vec2.scale(direction, direction, settings.maxAcceleration);
    this.applyForce(this.leftFoot, movementForce, deltaTimeInSeconds);
    this.applyForce(this.rightFoot, movementForce, deltaTimeInSeconds);

    if (!this.currentPlanet) {
      const leftFootGravity = forceAtPosition(
        this.leftFoot.center,
        intersectingWithForceField,
      );
      const rightFootGravity = forceAtPosition(
        this.rightFoot.center,
        intersectingWithForceField,
      );

      this.applyForce(this.leftFoot, leftFootGravity, deltaTimeInSeconds);
      this.applyForce(this.rightFoot, rightFootGravity, deltaTimeInSeconds);

      const sumForce = vec2.subtract(vec2.create(), leftFootGravity, movementForce);

      this.setDirection(
        vec2.length(sumForce) === 0 ? vec2.fromValues(0, -1) : sumForce,
        deltaTimeInSeconds,
      );
    } else {
      const leftFootGravity = this.currentPlanet!.getForce(this.leftFoot.center);
      const rightFootGravity = this.currentPlanet!.getForce(this.rightFoot.center);

      vec2.add(leftFootGravity, leftFootGravity, rightFootGravity);
      const gravity = vec2.scale(leftFootGravity, leftFootGravity, 0.5);

      if (vec2.dot(movementForce, gravity) < -vec2.length(movementForce) * 0.8) {
        vec2.scale(gravity, gravity, 0.35);
      }

      const scaledLeftFootGravity = vec2.scale(
        vec2.create(),
        this.leftFoot.lastNormal,
        vec2.dot(this.leftFoot.lastNormal, gravity),
      );
      this.applyForce(this.leftFoot, scaledLeftFootGravity, deltaTimeInSeconds);

      const scaledRightFootGravity = vec2.scale(
        vec2.create(),
        this.rightFoot.lastNormal,
        vec2.dot(this.rightFoot.lastNormal, gravity),
      );

      this.applyForce(this.rightFoot, scaledRightFootGravity, deltaTimeInSeconds);

      if (vec2.length(gravity) <= 100) {
        this.currentPlanet = undefined;
      }
      this.setDirection(gravity, deltaTimeInSeconds);
    }

    this.keepPosture(deltaTimeInSeconds);
    this.stepBodyPart(this.leftFoot, deltaTimeInSeconds);
    this.stepBodyPart(this.rightFoot, deltaTimeInSeconds);
    this.stepBodyPart(this.head, deltaTimeInSeconds);

    this.setPropertyUpdates(oldHead, oldLeftFoot, oldRightFoot, deltaTimeInSeconds);
  }

  private setDirection(direction: vec2, deltaTime: number) {
    this.direction = interpolateAngles(
      this.direction,
      Math.atan2(direction.y, direction.x) + Math.PI / 2,
      0.2,
    );
  }

  private keepPosture(deltaTime: number) {
    let center = this.center;
    this.springMove(
      this.leftFoot,
      center,
      CharacterPhysical.leftFootOffset,
      deltaTime,
      3000,
    );
    this.springMove(
      this.rightFoot,
      center,
      CharacterPhysical.rightFootOffset,
      deltaTime,
      3000,
    );

    this.springMove(this.head, center, CharacterPhysical.headOffset, deltaTime, 7000);
  }

  private springMove(
    object: CirclePhysical,
    center: vec2,
    offset: vec2,
    deltaTime: number,
    strength: number,
  ) {
    const desiredPosition = vec2.add(vec2.create(), center, offset);
    vec2.rotate(desiredPosition, desiredPosition, center, this.direction);
    const positionDelta = vec2.subtract(vec2.create(), desiredPosition, object.center);

    const positionDeltaLength = vec2.length(positionDelta);

    if (positionDeltaLength > 0) {
      const positionDeltaDirection = vec2.normalize(vec2.create(), positionDelta);
      vec2.scale(
        positionDelta,
        positionDeltaDirection,
        positionDeltaLength ** 2 * deltaTime * strength,
      );

      if (vec2.length(positionDelta) * deltaTime * deltaTime > positionDeltaLength) {
        vec2.scale(
          positionDelta,
          positionDelta,
          positionDeltaLength / (vec2.length(positionDelta) * deltaTime * deltaTime),
        );
      }

      object.applyForce(positionDelta, deltaTime);
    }
  }

  private stepBodyPart(part: CirclePhysical, deltaTime: number) {
    const { hitObject } = part.stepManually(deltaTime);
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
  }

  public onDie() {
    this.isDestroyed = true;
    this.remoteCall('onDie');
  }

  private destroy() {
    this.container.removeObject(this);
    this.container.removeObject(this.head);
    this.container.removeObject(this.leftFoot);
    this.container.removeObject(this.rightFoot);
  }
}
