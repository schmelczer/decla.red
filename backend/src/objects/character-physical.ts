import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  Circle,
  CharacterBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CharacterMovementSnapshot,
  GameObject,
  mix,
  clamp01,
  strengthToCharge,
  stepCharacterMovement,
  applyForce,
  applyLeapImpulse,
  decayMomentum,
  tickPlanetDetachment,
  characterCenter,
  sumGravity,
  CharacterWorld,
  GroundSurface,
  headRadius,
  feetRadius,
  headOffset,
  leftFootOffset,
  rightFootOffset,
  boundRadius,
} from 'shared';
import { addPointsForTeam } from '../game-events';
import { Physical } from '../physics/physical';
import { CirclePhysical } from './circle-physical';
import { PhysicalContainer } from '../physics/physical-container';
import { BoundingBox } from '../physics/bounding-box';
import { ProjectilePhysical } from './projectile-physical';
import { PlanetPhysical, planetsNear } from './planet-physical';

const placeholder = new Circle(vec2.create(), 0);

export class CharacterPhysical extends CharacterBase implements Physical {
  public readonly canCollide = true;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;

  public direction = 0;
  public currentPlanet: GroundSurface | undefined;
  public secondsSinceOnSurface = settings.planetDetachmentSeconds;
  public readonly bodyVelocity = vec2.create();

  private projectileStrength = settings.playerMaxStrength;
  private timeAlive = 0;
  private timeSinceDying = 0;
  private isDestroyed = false;
  private hasJustBorn = true;
  private hasFiredSinceSpawn = false;
  private timeSinceLastShot = settings.projectileCreationInterval;
  private timeSinceLastLeap = settings.leapCooldownSeconds;
  private timeSinceLastDamage = settings.playerOutOfCombatDelaySeconds;
  private lastSyncedHealth = settings.playerMaxHealth;
  private killStreak = 0;

  private readonly movementDirection = vec2.create();

  private readonly previousPose = [0, 1, 2].map(() => new Circle(vec2.create(), 0));
  private readonly velocities = [0, 1, 2].map(() => new Circle(vec2.create(), 0));
  private readonly box = new BoundingBox();

  constructor(
    name: string,
    killCount: number,
    deathCount: number,
    team: CharacterTeam,
    private readonly container: PhysicalContainer,
    startPosition: vec2,
  ) {
    super(
      id(),
      name,
      killCount,
      deathCount,
      team,
      settings.playerMaxHealth,
      placeholder,
      placeholder,
      placeholder,
    );
    const part = (offset: vec2, radius: number) =>
      new CirclePhysical(
        vec2.add(vec2.create(), startPosition, offset),
        radius,
        this,
        container,
      );
    this.head = part(headOffset, headRadius);
    this.leftFoot = part(leftFootOffset, feetRadius);
    this.rightFoot = part(rightFootOffset, feetRadius);
  }

  private readonly movementWorld: CharacterWorld = {
    groundsNear: (center, radius) => planetsNear(this.container, center, radius),
    stepBody: (body, deltaTimeInSeconds) => {
      const hit = (body as CirclePhysical).stepManually(deltaTimeInSeconds);
      return hit instanceof PlanetPhysical ? hit : undefined;
    },
  };

  private get parts(): Array<CirclePhysical> {
    return [this.head, this.leftFoot, this.rightFoot];
  }

  private get isSpawnProtected(): boolean {
    return (
      !this.hasFiredSinceSpawn &&
      this.timeAlive <
        settings.spawnDespawnTime + settings.spawnInvulnerabilityExtraSeconds
    );
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  public get groundPlanet(): PlanetPhysical | undefined {
    return this.currentPlanet as PlanetPhysical | undefined;
  }

  public get movementSnapshot(): CharacterMovementSnapshot {
    return new CharacterMovementSnapshot(
      this.direction,
      vec2.clone(this.bodyVelocity),
      vec2.clone(this.leftFoot.lastNormal),
      vec2.clone(this.rightFoot.lastNormal),
      this.groundPlanet?.id ?? null,
      this.secondsSinceOnSurface,
      Math.max(0, settings.leapCooldownSeconds - this.timeSinceLastLeap),
    );
  }

  public get boundingBox(): BoundingBox {
    return this.box.setCircle(this.center, boundRadius);
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

  public setMoveDirection(direction: vec2) {
    vec2.normalize(this.movementDirection, direction);
  }

  public addKill(victimName: string, charge = 0) {
    this.killCount++;
    this.killStreak++;
    this.remoteCall('setKillCount', this.killCount);

    if (this.isAlive) {
      this.health = Math.min(
        settings.playerMaxHealth,
        this.health + settings.playerKillHealthReward,
      );
      this.syncHealth();
    }
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

  public onCollision(other: GameObject) {
    if (
      !this.isAlive ||
      !(other instanceof ProjectilePhysical) ||
      other.team === this.team ||
      !other.isAlive
    ) {
      return;
    }

    other.destroy();

    if (this.isSpawnProtected) {
      return;
    }

    this.timeSinceLastDamage = 0;
    this.health -= other.strength;
    this.lastSyncedHealth = Math.round(this.health);
    this.remoteCall('setHealth', this.health);

    if (this.health <= 0) {
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

  public shootTowards(position: vec2, charge = 0) {
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

    const desiredStrength = mix(
      settings.chargeShotStrengthMin,
      settings.chargeShotStrengthMax,
      clamp01(charge),
    );
    const strength = Math.min(desiredStrength, this.projectileStrength);
    this.projectileStrength -= strength;

    const c = strengthToCharge(strength);
    const radius = mix(settings.chargeShotRadiusMin, settings.chargeShotRadiusMax, c);
    const speed = mix(settings.chargeShotSpeedMin, settings.chargeShotSpeedMax, c);

    vec2.normalize(direction, direction);
    this.container.addObject(
      new ProjectilePhysical(
        vec2.clone(this.center),
        radius,
        strength,
        this.team,
        vec2.scale(vec2.create(), direction, speed),
        this,
        this.container,
        c,
      ),
    );

    if (c > 0) {
      vec2.scaleAndAdd(
        this.bodyVelocity,
        this.bodyVelocity,
        direction,
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
    applyLeapImpulse(this, this.movementDirection);
    this.remoteCall('onLeap');
  }

  public onDie(killedInCombat = false) {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    this.remoteCall('onDie');

    if (killedInCombat) {
      const opposingTeam =
        this.team === CharacterTeam.blue ? CharacterTeam.red : CharacterTeam.blue;
      addPointsForTeam(this.container.game, opposingTeam, settings.playerKillPoint);
    }
  }

  public getPropertyUpdates(timeScale = 1): PropertyUpdatesForObject {
    const [headVelocity, leftFootVelocity, rightFootVelocity] = this.velocities.map(
      (velocity) =>
        new Circle(
          vec2.scale(vec2.create(), velocity.center, timeScale),
          velocity.radius * timeScale,
        ),
    );
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('head', this.head, headVelocity),
      new UpdatePropertyCommand('leftFoot', this.leftFoot, leftFootVelocity),
      new UpdatePropertyCommand('rightFoot', this.rightFoot, rightFootVelocity),
      new UpdatePropertyCommand(
        'strength',
        this.projectileStrength,
        settings.playerStrengthRegenerationPerSeconds * timeScale,
      ),
    ]);
  }

  public step(deltaTimeInSeconds: number) {
    this.timeAlive += deltaTimeInSeconds;
    this.timeSinceLastLeap += deltaTimeInSeconds;
    this.parts.forEach((part, i) => {
      vec2.copy(this.previousPose[i].center, part.center);
      this.previousPose[i].radius = part.radius;
    });

    if (this.isDestroyed) {
      if ((this.timeSinceDying += deltaTimeInSeconds) > settings.spawnDespawnTime) {
        this.container.removeObject(this);
      } else {
        this.freeFallCorpse(deltaTimeInSeconds);
        this.animateScaling(1 - this.timeSinceDying / settings.spawnDespawnTime);
      }
    } else if (this.hasJustBorn) {
      if (this.timeAlive > settings.spawnDespawnTime) {
        this.hasJustBorn = false;
        this.animateScaling(1);
      } else {
        this.animateScaling(this.timeAlive / settings.spawnDespawnTime);
      }
    } else {
      this.stepAlive(deltaTimeInSeconds);
    }

    this.parts.forEach((part, i) => {
      const velocity = this.velocities[i];
      const previous = this.previousPose[i];
      vec2.subtract(velocity.center, part.center, previous.center);
      vec2.scale(velocity.center, velocity.center, 1 / deltaTimeInSeconds);
      velocity.radius = (part.radius - previous.radius) / deltaTimeInSeconds;
    });
  }

  private stepAlive(deltaTimeInSeconds: number) {
    tickPlanetDetachment(this, deltaTimeInSeconds);

    this.timeSinceLastShot += deltaTimeInSeconds;
    this.projectileStrength = Math.min(
      settings.playerMaxStrength,
      this.projectileStrength +
        settings.playerStrengthRegenerationPerSeconds * deltaTimeInSeconds,
    );

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

    this.groundPlanet?.registerPresence(this);

    stepCharacterMovement(
      this,
      this.movementWorld,
      this.movementDirection,
      deltaTimeInSeconds,
    );
  }

  private animateScaling(q: number) {
    this.head.radius = headRadius * q;
    this.leftFoot.radius = this.rightFoot.radius = feetRadius * q;
  }

  private freeFallCorpse(deltaTime: number) {
    const planets = this.movementWorld.groundsNear(
      this.center,
      boundRadius + settings.maxGravityDistance,
    );
    let grounded = false;
    for (const part of this.parts) {
      vec2.copy(part.velocity, this.bodyVelocity);
      applyForce(part, sumGravity(planets, part.center), deltaTime);
      if (part.stepManually(deltaTime) instanceof PlanetPhysical) {
        grounded = true;
      }
    }
    decayMomentum(this.bodyVelocity, grounded, deltaTime);
  }
}
