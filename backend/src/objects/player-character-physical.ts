import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  MoveActionCommand,
  serializesTo,
  clamp,
  last,
  GameObject,
  Circle,
  PlayerCharacterBase,
  CharacterTeam,
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
import { UpdateObjectMessage } from 'shared/lib/src/objects/update-object-message';
import { UpdateGameObjectMessage } from '../update-game-object-message';

@serializesTo(PlayerCharacterBase)
export class PlayerCharacterPhysical
  extends PlayerCharacterBase
  implements DynamicPhysical, ReactsToCollision {
  public readonly canCollide = true;
  public readonly canMove = true;

  private static readonly headRadius = 50;
  private static readonly feetRadius = 20;
  private projectileStrength = settings.playerMaxStrength;

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
        PlayerCharacterPhysical.desiredHeadOffset,
        PlayerCharacterPhysical.desiredLeftFootOffset,
      ),
      PlayerCharacterPhysical.desiredRightFootOffset,
    ),
    1 / 3,
  );

  private static readonly headOffset = vec2.subtract(
    vec2.create(),
    PlayerCharacterPhysical.desiredHeadOffset,
    PlayerCharacterPhysical.centerOfMass,
  );
  private static readonly leftFootOffset = vec2.subtract(
    vec2.create(),
    PlayerCharacterPhysical.desiredLeftFootOffset,
    PlayerCharacterPhysical.centerOfMass,
  );
  private static readonly rightFootOffset = vec2.subtract(
    vec2.create(),
    PlayerCharacterPhysical.desiredRightFootOffset,
    PlayerCharacterPhysical.centerOfMass,
  );

  public static readonly boundRadius =
    (PlayerCharacterPhysical.headRadius + PlayerCharacterPhysical.feetRadius * 2) * 2;

  private isDestroyed = false;
  private direction = 0;
  private currentPlanet?: PlanetPhysical;
  private lastMovementWasRelative = false;
  private secondsSinceOnSurface = 1000;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;
  public bound: CirclePhysical;

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  private movementActions: Array<MoveActionCommand> = [];
  private lastMovementAction: MoveActionCommand = new MoveActionCommand(
    vec2.create(),
    false,
  );

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
      vec2.add(vec2.create(), startPosition, PlayerCharacterPhysical.headOffset),
      PlayerCharacterPhysical.headRadius,
      this,
      container,
    );
    this.leftFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, PlayerCharacterPhysical.leftFootOffset),
      PlayerCharacterPhysical.feetRadius,
      this,
      container,
    );
    this.rightFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, PlayerCharacterPhysical.rightFootOffset),
      PlayerCharacterPhysical.feetRadius,
      this,
      container,
    );
    container.addObject(this.head);
    container.addObject(this.leftFoot);
    container.addObject(this.rightFoot);

    this.bound = new CirclePhysical(
      vec2.create(),
      PlayerCharacterPhysical.boundRadius,
      this,
      container,
    );
  }

  public calculateUpdates(): UpdateObjectMessage {
    return new UpdateGameObjectMessage(this, [
      'head',
      'leftFoot',
      'rightFoot',
      'health',
      'killCount',
    ]);
  }

  public handleMovementAction(c: MoveActionCommand) {
    this.movementActions.push(c);
  }

  public onCollision(other: GameObject) {
    if (
      other instanceof ProjectilePhysical &&
      other.team !== this.team &&
      other.isAlive
    ) {
      other.destroy();
      this.health -= other.strength;
      if (this.health <= 0) {
        this.destroy();
        other.originator.killCount++;
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

    this.projectileStrength = Math.min(
      settings.playerMaxStrength,
      this.projectileStrength + settings.playerStrengthRegenerationPerSeconds * deltaTime,
    );

    this.currentPlanet?.takeControl(this.team, deltaTime);

    const intersectingWithForcefield = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(
          this.center,
          PlayerCharacterPhysical.boundRadius + settings.maxGravityDistance,
        ),
      ),
    );
    const feetCenter = vec2.add(
      vec2.create(),
      this.leftFoot.center,
      this.rightFoot.center,
    );
    vec2.scale(feetCenter, feetCenter, 0.5);
    const actualGravity = forceAtPosition(feetCenter, intersectingWithForcefield);

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

      if (this.lastMovementWasRelative) {
        vec2.rotate(movementForce, movementForce, vec2.create(), this.direction);
      }

      if (vec2.dot(movementForce, actualGravity) < -vec2.length(movementForce) * 0.8) {
        vec2.scale(leftFootGravity, leftFootGravity, 0.35);
        vec2.scale(rightFootGravity, rightFootGravity, 0.35);
      }
      this.applyForce(this.leftFoot, leftFootGravity, deltaTime);
      this.applyForce(this.rightFoot, rightFootGravity, deltaTime);

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
    this.springMove(this.leftFoot, bodyCenter, PlayerCharacterPhysical.leftFootOffset);
    this.springMove(this.rightFoot, bodyCenter, PlayerCharacterPhysical.rightFootOffset);
    this.springMove(this.head, bodyCenter, PlayerCharacterPhysical.headOffset);
  }

  private springMove(object: CirclePhysical, center: vec2, offset: vec2) {
    // todo: make time-independent
    const springConstant = 0.55;

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
