import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  MoveActionCommand,
  serializesTo,
  Circle,
  CharacterBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CommandExecutors,
  CommandReceiver,
  CharacterMovementSnapshot,
  mix,
  clamp01,
  strengthToCharge,
  stepCharacterMovement,
  applyLeapImpulse,
  decayMomentum,
  tickPlanetDetachment,
  characterCenter,
  CharacterWorld,
  GroundSurface,
  headRadius,
  feetRadius,
  headOffset,
  leftFootOffset,
  rightFootOffset,
  boundRadius,
} from 'shared';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { CirclePhysical } from './circle-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { ProjectilePhysical } from './projectile-physical';
import { forceAtPosition } from '../physics/functions/force-at-position';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { PlanetPhysical } from './planet-physical';
import {
  StepCommand,
  ReactToCollisionCommand,
  GeneratePointsCommand,
} from '../commands/commands';

interface BodyPose {
  head: Circle;
  leftFoot: Circle;
  rightFoot: Circle;
}

@serializesTo(CharacterBase)
export class CharacterPhysical extends CharacterBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;

  private projectileStrength = settings.playerMaxStrength;

  private timeSinceDying = 0;
  private isDestroyed = false;
  private timeSinceBorn = 0;
  private hasJustBorn = true;
  private timeAlive = 0;

  private timeSinceLastShot = settings.projectileCreationInterval;
  private timeSinceLastDamage = settings.playerOutOfCombatDelaySeconds;
  private lastSyncedHealth = settings.playerMaxHealth;

  private killStreak = 0;

  // Held in place: the shared simulation reads and writes these directly, so
  // the character IS the state it is stepped as (client predictor agrees).
  public direction = 0;
  public currentPlanet: GroundSurface | undefined;
  public secondsSinceOnSurface = settings.planetDetachmentSeconds;
  public readonly bodyVelocity = vec2.create();

  private timeSinceLastLeap = settings.leapCooldownSeconds;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;

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
      vec2.add(vec2.create(), startPosition, headOffset),
      headRadius,
      this,
      container,
    );
    this.leftFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, leftFootOffset),
      feetRadius,
      this,
      container,
    );
    this.rightFoot = new CirclePhysical(
      vec2.add(vec2.create(), startPosition, rightFootOffset),
      feetRadius,
      this,
      container,
    );
    container.addObject(this.head);
    container.addObject(this.leftFoot);
    container.addObject(this.rightFoot);
  }

  private readonly movementWorld: CharacterWorld = {
    // Same set and order forceAtPosition uses, so the f64 gravity sum matches.
    groundsNear: (center, radius) =>
      this.container
        .findIntersecting(getBoundingBoxOfCircle(new Circle(center, radius)))
        .filter((o): o is PlanetPhysical => o instanceof PlanetPhysical),
    stepBody: (body, deltaTimeInSeconds) => {
      const { hitObject } = (body as CirclePhysical).stepManually(deltaTimeInSeconds);
      return hitObject instanceof PlanetPhysical ? hitObject : undefined;
    },
  };

  private hasFiredSinceSpawn = false;
  private get isSpawnProtected(): boolean {
    return (
      !this.hasFiredSinceSpawn &&
      this.timeAlive <
        settings.spawnDespawnTime + settings.spawnInvulnerabilityExtraSeconds
    );
  }

  private hasGeneratedPoints = false;
  private wasKilledInCombat = false;
  private getPoints(game: CommandReceiver) {
    if (!this.isAlive && !this.hasGeneratedPoints) {
      this.hasGeneratedPoints = true;

      if (!this.wasKilledInCombat) {
        return;
      }

      const blue = this.team === CharacterTeam.blue ? 0 : settings.playerKillPoint;
      const red = this.team === CharacterTeam.red ? 0 : settings.playerKillPoint;

      game.handleCommand(new GeneratePointsCommand(blue, red));
    }
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  public handleMovementAction(c: MoveActionCommand) {
    this.movementActions.push(c);
  }

  // The world only ever hands back planets, so narrowing GroundSurface is safe.
  public get groundPlanet(): PlanetPhysical | undefined {
    return this.currentPlanet as PlanetPhysical | undefined;
  }

  // Continuous movement state streamed to the owning client so its predictor
  // resumes this simulation instead of guessing. See CharacterMovementSnapshot.
  public get movementSnapshot(): CharacterMovementSnapshot {
    return new CharacterMovementSnapshot(
      this.direction,
      vec2.clone(this.bodyVelocity),
      vec2.clone(this.leftFoot.lastNormal),
      vec2.clone(this.rightFoot.lastNormal),
      this.groundPlanet?.id ?? null,
      this.secondsSinceOnSurface,
    );
  }

  public addKill(victimName: string, charge = 0) {
    this.killCount++;
    this.killStreak++;
    this.remoteCall('setKillCount', this.killCount);

    this.health = Math.min(
      settings.playerMaxHealth,
      this.health + settings.playerKillHealthReward,
    );
    this.syncHealth();
    this.remoteCall('onKillConfirmed', victimName, this.killStreak, charge);
  }

  public registerHit(charge = 0) {
    this.remoteCall('onHitConfirmed', charge);
  }

  private syncHealth() {
    const rounded = Math.round(this.health);
    if (rounded !== this.lastSyncedHealth) {
      this.lastSyncedHealth = rounded;
      this.remoteCall('setHealth', this.health);
    }
  }

  public onCollision({ other }: ReactToCollisionCommand) {
    if (
      // A corpse keeps its collidable circles for the despawn animation; the
      // isAlive guard stops a flying corpse from eating shots aimed past it.
      this.isAlive &&
      other instanceof ProjectilePhysical &&
      other.team !== this.team &&
      other.isAlive
    ) {
      other.destroy();

      if (this.isSpawnProtected) {
        return;
      }

      this.timeSinceLastDamage = 0;
      this.health -= other.strength;
      this.lastSyncedHealth = Math.round(this.health);
      this.remoteCall('setHealth', this.health);

      if (this.health <= 0 && this.isAlive) {
        vec2.scaleAndAdd(
          this.bodyVelocity,
          this.bodyVelocity,
          other.direction,
          mix(settings.deathImpulseMin, settings.deathImpulseMax, other.charge),
        );
        this.onDie(true);
        other.originator.addKill(this.name, other.charge);
      } else {
        other.originator.registerHit(other.charge);
      }
    }
  }

  public shootTowards(position: vec2, charge = 0, catchUpSeconds = 0) {
    if (
      !this.isAlive ||
      this.timeSinceLastShot < settings.projectileCreationInterval ||
      this.projectileStrength < settings.chargeShotStrengthMin
    ) {
      return;
    }

    const direction = vec2.subtract(vec2.create(), position, this.center);
    if (vec2.length(direction) === 0) {
      return;
    }

    this.timeSinceLastShot = 0;
    this.hasFiredSinceSpawn = true;

    const requestedCharge = clamp01(charge);
    const desiredStrength = mix(
      settings.chargeShotStrengthMin,
      settings.chargeShotStrengthMax,
      requestedCharge,
    );
    const strength = Math.min(desiredStrength, this.projectileStrength);
    this.projectileStrength -= strength;

    const c = strengthToCharge(strength);

    const radius = mix(settings.chargeShotRadiusMin, settings.chargeShotRadiusMax, c);
    const speed = mix(settings.chargeShotSpeedMin, settings.chargeShotSpeedMax, c);

    vec2.normalize(direction, direction);
    // Keep the unit direction before vec2.scale repurposes it as the velocity.
    const shotDirection = vec2.clone(direction);
    const velocity = vec2.scale(direction, direction, speed);
    const projectile = new ProjectilePhysical(
      vec2.clone(this.center),
      radius,
      strength,
      this.team,
      velocity,
      this,
      this.container,
      c,
    );
    this.container.addObject(projectile);
    projectile.fastForward(catchUpSeconds);

    if (c > 0) {
      vec2.scaleAndAdd(
        this.bodyVelocity,
        this.bodyVelocity,
        shotDirection,
        -settings.chargeShotRecoilMax * c,
      );
    }

    this.remoteCall('onShoot', strength);
  }

  public leap() {
    if (
      !this.isAlive ||
      this.hasJustBorn ||
      !this.currentPlanet ||
      this.timeSinceLastLeap < settings.leapCooldownSeconds ||
      this.projectileStrength < settings.leapStrengthCost
    ) {
      return;
    }

    this.timeSinceLastLeap = 0;
    this.projectileStrength -= settings.leapStrengthCost;

    // Same impulse the client predicts with (shared), so a leap launches
    // identically on both sides.
    applyLeapImpulse(this, this.lastMovementAction.direction);
    this.remoteCall('onLeap');
  }

  public get boundingBox(): BoundingBoxBase {
    return getBoundingBoxOfCircle(new Circle(this.center, boundRadius));
  }

  public get gameObject(): this {
    return this;
  }

  public get center(): vec2 {
    return characterCenter(this.head, this.leftFoot, this.rightFoot);
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

      const actions = this.movementActions;
      this.lastMovementAction = actions[actions.length - 1]!;
      this.movementActions = [];
    }

    return vec2.length(direction) > 0
      ? vec2.normalize(direction, direction)
      : vec2.create();
  }

  private animateScaling(q: number) {
    this.head.radius = headRadius * q;
    this.leftFoot.radius = this.rightFoot.radius = feetRadius * q;
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('head', this.head, this.headVelocity),
      new UpdatePropertyCommand('leftFoot', this.leftFoot, this.leftFootVelocity),
      new UpdatePropertyCommand('rightFoot', this.rightFoot, this.rightFootVelocity),
      new UpdatePropertyCommand(
        'strength',
        this.projectileStrength,
        settings.playerStrengthRegenerationPerSeconds,
      ),
    ]);
  }

  // `previous` is consumed as scratch so this allocates nothing beyond the
  // Circle it returns.
  private static rateOfChange(previous: Circle, current: Circle, deltaTime: number) {
    return new Circle(
      vec2.scale(
        previous.center,
        vec2.subtract(previous.center, current.center, previous.center),
        1 / deltaTime,
      ),
      (current.radius - previous.radius) / deltaTime,
    );
  }

  private setPropertyUpdates(previous: BodyPose, deltaTime: number) {
    const rate = CharacterPhysical.rateOfChange;
    this.headVelocity = rate(previous.head, this.head, deltaTime);
    this.leftFootVelocity = rate(previous.leftFoot, this.leftFoot, deltaTime);
    this.rightFootVelocity = rate(previous.rightFoot, this.rightFoot, deltaTime);
  }

  private get pose(): BodyPose {
    const snapshot = (circle: Circle) =>
      new Circle(vec2.clone(circle.center), circle.radius);
    return {
      head: snapshot(this.head),
      leftFoot: snapshot(this.leftFoot),
      rightFoot: snapshot(this.rightFoot),
    };
  }

  private step({ deltaTimeInSeconds, game }: StepCommand) {
    this.getPoints(game);
    this.timeAlive += deltaTimeInSeconds;
    this.timeSinceLastLeap += deltaTimeInSeconds;
    const previousPose = this.pose;

    if (this.isDestroyed) {
      if ((this.timeSinceDying += deltaTimeInSeconds) > settings.spawnDespawnTime) {
        this.destroy();
      } else {
        this.freeFallCorpse(deltaTimeInSeconds);
        this.animateScaling(1 - this.timeSinceDying / settings.spawnDespawnTime);
      }
      this.setPropertyUpdates(previousPose, deltaTimeInSeconds);
      return;
    }

    if (this.hasJustBorn) {
      if ((this.timeSinceBorn += deltaTimeInSeconds) > settings.spawnDespawnTime) {
        this.hasJustBorn = false;
        this.animateScaling(1);
      } else {
        this.animateScaling(this.timeSinceBorn / settings.spawnDespawnTime);
      }
      this.setPropertyUpdates(previousPose, deltaTimeInSeconds);
      return;
    }

    tickPlanetDetachment(this, deltaTimeInSeconds);

    this.timeSinceLastShot += deltaTimeInSeconds;

    this.projectileStrength = Math.min(
      settings.playerMaxStrength,
      this.projectileStrength +
        settings.playerStrengthRegenerationPerSeconds * deltaTimeInSeconds,
    );

    this.regenerateHealth(deltaTimeInSeconds);

    this.groundPlanet?.registerPresence(this);

    // stepCharacterMovement is the shared simulation the client predicts with,
    // so the two can never drift.
    const direction = this.averageAndResetMovementActions();
    stepCharacterMovement(this, this.movementWorld, direction, deltaTimeInSeconds);

    this.setPropertyUpdates(previousPose, deltaTimeInSeconds);
  }

  private freeFallCorpse(deltaTime: number) {
    const intersecting = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(this.center, boundRadius + settings.maxGravityDistance),
      ),
    );
    let grounded = false;
    for (const part of [this.leftFoot, this.rightFoot, this.head]) {
      part.applyForce(forceAtPosition(part.center, intersecting), deltaTime);
      vec2.add(part.velocity, part.velocity, this.bodyVelocity);
      const { hitObject } = part.stepManually(deltaTime);
      if (hitObject instanceof PlanetPhysical) {
        grounded = true;
      }
    }
    // Brake with the shared model the living body uses, so a flung corpse
    // comes to a definite stop instead of sliding forever.
    decayMomentum(this.bodyVelocity, grounded, deltaTime);
  }

  private regenerateHealth(deltaTimeInSeconds: number) {
    this.timeSinceLastDamage += deltaTimeInSeconds;
    if (
      this.timeSinceLastDamage > settings.playerOutOfCombatDelaySeconds &&
      this.health < settings.playerMaxHealth
    ) {
      this.health = Math.min(
        settings.playerMaxHealth,
        this.health + settings.playerHealthRegenerationPerSeconds * deltaTimeInSeconds,
      );
      this.syncHealth();
    }
  }

  public onDie(killedInCombat = false) {
    this.wasKilledInCombat = killedInCombat;
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
