import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  MoveActionCommand,
  serializesTo,
  last,
  Circle,
  CharacterBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CommandExecutors,
  CommandReceiver,
  mix,
  clamp01,
  stepCharacterMovement,
  applyLeapImpulse,
  decayMomentum,
  CharacterMovementState,
  CharacterWorld,
  GroundSurface,
} from 'shared';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { CirclePhysical } from './circle-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { ProjectilePhysical } from './projectile-physical';
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

  // offsets are measured from (0, 0). The head sits this far above the feet,
  // which sets the leg length: kept short so the body reads as a compact head on
  // stubby legs rather than a long-legged strider.
  private static readonly desiredHeadOffset = vec2.fromValues(0, 55);
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
  private timeAlive = 0;

  private timeSinceLastShot = settings.projectileCreationInterval;
  private timeSinceLastDamage = settings.playerOutOfCombatDelaySeconds;
  private lastSyncedHealth = settings.playerMaxHealth;

  private killStreak = 0;

  private direction = 0;
  private currentPlanet?: PlanetPhysical;
  private secondsSinceOnSurface = settings.planetDetachmentSeconds;

  private bodyVelocity = vec2.create();
  private timeSinceLastLeap = settings.leapCooldownSeconds;

  public head: CirclePhysical;
  public leftFoot: CirclePhysical;
  public rightFoot: CirclePhysical;

  private movementState!: CharacterMovementState;
  private movementWorld!: CharacterWorld;

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

    this.initMovementBridge();
  }

  private initMovementBridge() {
    const self = this;
    this.movementState = {
      head: this.head,
      leftFoot: this.leftFoot,
      rightFoot: this.rightFoot,
      get direction() {
        return self.direction;
      },
      set direction(value: number) {
        self.direction = value;
      },
      get currentPlanet() {
        return self.currentPlanet;
      },
      set currentPlanet(value: GroundSurface | undefined) {
        // On the server every ground is a PlanetPhysical (the world only ever
        // hands back planets), so this narrowing is safe.
        self.currentPlanet = value as PlanetPhysical | undefined;
      },
      get secondsSinceOnSurface() {
        return self.secondsSinceOnSurface;
      },
      set secondsSinceOnSurface(value: number) {
        self.secondsSinceOnSurface = value;
      },
      bodyVelocity: this.bodyVelocity,
    };

    this.movementWorld = {
      // Same set and order forceAtPosition used: planets in the force field,
      // in container-traversal order (so the f64 gravity sum is unchanged).
      groundsNear: (center, radius) =>
        self.container
          .findIntersecting(getBoundingBoxOfCircle(new Circle(center, radius)))
          .filter((o): o is PlanetPhysical => o instanceof PlanetPhysical),
      stepBody: (body, deltaTimeInSeconds) => {
        const { hitObject } = (body as CirclePhysical).stepManually(deltaTimeInSeconds);
        return hitObject instanceof PlanetPhysical ? hitObject : undefined;
      },
    };
  }

  private get isSpawnProtected(): boolean {
    return (
      this.timeAlive <
      settings.spawnDespawnTime + settings.spawnInvulnerabilityExtraSeconds
    );
  }

  private hasGeneratedPoints = false;
  private getPoints(game: CommandReceiver) {
    if (!this.isAlive && !this.hasGeneratedPoints) {
      this.hasGeneratedPoints = true;
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

  public get groundPlanet(): PlanetPhysical | undefined {
    return this.currentPlanet;
  }

  // Persistent launch momentum, streamed to the owning client so its predictor
  // can reproduce a leap/slingshot/recoil flight instead of only snapping to it.
  public get launchMomentum(): vec2 {
    return this.bodyVelocity;
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
        // Throw the corpse along the killing shot, harder for charged hits.
        vec2.scaleAndAdd(
          this.bodyVelocity,
          this.bodyVelocity,
          other.direction,
          mix(settings.deathImpulseMin, settings.deathImpulseMax, other.charge),
        );
        this.onDie();
        other.originator.addKill(this.name, other.charge);
      } else {
        other.originator.registerHit(other.charge);
      }
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

    this.timeSinceLastShot = 0;

    const c = clamp01(charge);
    const desiredStrength = mix(
      settings.chargeShotStrengthMin,
      settings.chargeShotStrengthMax,
      c,
    );
    const strength = Math.min(desiredStrength, this.projectileStrength);
    this.projectileStrength -= strength;

    const radius = mix(settings.chargeShotRadiusMin, settings.chargeShotRadiusMax, c);
    const speed = mix(settings.chargeShotSpeedMin, settings.chargeShotSpeedMax, c);

    const direction = vec2.subtract(vec2.create(), position, this.center);
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
    applyLeapImpulse(this.movementState, this.lastMovementAction.direction);
    this.remoteCall('onLeap');
  }

  public get boundingBox(): BoundingBoxBase {
    return getBoundingBoxOfCircle(new Circle(this.center, CharacterPhysical.boundRadius));
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
      new UpdatePropertyCommand(
        'strength',
        this.projectileStrength,
        settings.playerStrengthRegenerationPerSeconds,
      ),
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
    this.timeAlive += deltaTimeInSeconds;
    this.timeSinceLastLeap += deltaTimeInSeconds;
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
        this.freeFallCorpse(deltaTimeInSeconds);
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

    if (
      (this.secondsSinceOnSurface += deltaTimeInSeconds) >
      settings.planetDetachmentSeconds
    ) {
      this.currentPlanet = undefined;
    }

    this.timeSinceLastShot += deltaTimeInSeconds;

    this.projectileStrength = Math.min(
      settings.playerMaxStrength,
      this.projectileStrength +
      settings.playerStrengthRegenerationPerSeconds * deltaTimeInSeconds,
    );

    this.regenerateHealth(deltaTimeInSeconds);

    // The planet tallies who is standing on it and resolves capture itself, so
    // a contested rock can freeze instead of two squads silently cancelling.
    this.currentPlanet?.registerPresence(this);

    // The whole walking model — gravity gather, movement force, on/off-planet
    // branch, posture springs, body-momentum, and stepping the three parts —
    // is the shared simulation the client predicts with, so the two can never
    // drift. Server-only concerns (scoring, health, shooting, spawn/death,
    // ownership) stay here around it.
    const direction = this.averageAndResetMovementActions();
    stepCharacterMovement(
      this.movementState,
      this.movementWorld,
      direction,
      deltaTimeInSeconds,
    );

    this.setPropertyUpdates(oldHead, oldLeftFoot, oldRightFoot, deltaTimeInSeconds);
  }

  private freeFallCorpse(deltaTime: number) {
    const intersecting = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(
          this.center,
          CharacterPhysical.boundRadius + settings.maxGravityDistance,
        ),
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
    // Brake with the exact shared model the living body uses: stiff on contact
    // so the corpse skids to rest, gentle in the air, plus the constant stop and
    // the speed cap — so a flung corpse comes to a definite stop instead of
    // sliding forever.
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
