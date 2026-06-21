import { vec2 } from 'gl-matrix';
import {
  PlayerInformation,
  settings,
  Circle,
  Random,
  MoveActionCommand,
  CharacterTeam,
  Id,
} from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { CharacterPhysical } from '../objects/character-physical';
import { PlanetPhysical } from '../objects/planet-physical';
import { ProjectilePhysical } from '../objects/projectile-physical';
import { Physical } from '../physics/physicals/physical';

const npcTuning = {
  planIntervalSeconds: 1,
  shootIntervalSeconds: 1.5,
  reactionIntervalSeconds: 1 / 10,
  reactionObserveRadius: 1400,
  planScanRadius: 3500,

  aggressionMin: 0.25,
  aggressionMax: 1,

  wanderReconsiderSeconds: 5,
  wanderProbability: 0.4,
  wanderTurn: 0.3,

  fleeBaseRange: 240,
  fleeAggressionFalloff: 1.4,

  chaseBaseRange: 700,
  chaseAggressionRange: 1600,
  captureHoldEnemyDistance: 500,

  dodgeThreatRange: 450,
  dodgeApproachDot: 0.6,

  dodgeBaseChance: 0.25,
  dodgeAggressionChance: 0.35,
  dodgeCommitSeconds: 0.35,
  dodgeCooldownSeconds: 0.5,

  lineOfSightClearance: 20,
  lineOfSightStartOffset: 100,

  fireBaseChance: 0.45,
  fireAggressionChance: 0.45,

  chargeRangeThreshold: 500,
  chargeBaseChance: 0.3,
  chargeAggressionChance: 0.4,
  chargeMin: 0.6,

  spreadBase: 60,
  spreadPerDistance: 0.08,
  spreadAggressionFalloff: 1.3,

  // Per-second chance to hop while grounded and on the move, so bots use the
  // leap verb too instead of being grounded targets.
  leapChancePerSecond: 0.35,
};

export class NPC extends PlayerBase {
  private direction = vec2.fromValues(Random.getRandom() - 0.5, Random.getRandom() - 0.5);
  private timeSinceLastPlan = 10000;
  private timeSinceLastShoot = 10000;
  private isWandering = false;
  private timeSinceLastWanderingConsideration = 0;
  private isComingBack = false;

  private readonly aggression = Random.getRandomInRange(
    npcTuning.aggressionMin,
    npcTuning.aggressionMax,
  );

  private aimTargetId: Id = null;
  private readonly aimTargetLastPosition = vec2.create();

  private readonly dodgeDirection = vec2.create();
  private dodgeCommitRemaining = 0;
  private dodgeCooldownRemaining = 0;

  private timeSinceObserve = npcTuning.reactionIntervalSeconds;
  private nearObjects: Array<Physical> = [];

  constructor(
    playerInfo: PlayerInformation,
    playerContainer: PlayerContainer,
    objectContainer: PhysicalContainer,
    team: CharacterTeam,
  ) {
    super(playerInfo, playerContainer, objectContainer, team);
    this.createCharacter();
    this.step(0);
  }

  private timeUntilRespawn = 0;
  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;
        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
        return;
      }
    } else {
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        this.createCharacter();
        this.center = this.character!.center;
      }
      return;
    }

    if (
      (this.timeSinceLastWanderingConsideration += deltaTimeInSeconds) >
      npcTuning.wanderReconsiderSeconds
    ) {
      this.timeSinceLastWanderingConsideration = 0;
      this.isWandering = Random.getRandom() < npcTuning.wanderProbability;
    }

    if ((this.timeSinceLastPlan += deltaTimeInSeconds) > npcTuning.planIntervalSeconds) {
      this.timeSinceLastPlan = 0;
      this.plan();
    }

    if (
      (this.timeSinceObserve += deltaTimeInSeconds) > npcTuning.reactionIntervalSeconds
    ) {
      this.timeSinceObserve = 0;
      this.nearObjects = this.observe(npcTuning.reactionObserveRadius);
    }

    this.dodgeCommitRemaining -= deltaTimeInSeconds;
    this.dodgeCooldownRemaining -= deltaTimeInSeconds;
    const movement = this.decideMovement(this.nearObjects);
    this.character.handleMovementAction(new MoveActionCommand(movement));

    if (
      !this.isComingBack &&
      this.character.groundPlanet &&
      vec2.length(movement) > 0 &&
      Random.getRandom() <
        npcTuning.leapChancePerSecond * this.aggression * deltaTimeInSeconds
    ) {
      this.character.leap();
    }

    if (
      (this.timeSinceLastShoot += deltaTimeInSeconds) > npcTuning.shootIntervalSeconds
    ) {
      this.timeSinceLastShoot = 0;
      this.tryShoot(this.nearObjects);
    }
  }

  private plan() {
    const distanceFromCentre = vec2.length(this.center);
    if (
      (!this.isComingBack && distanceFromCentre > settings.worldRadius) ||
      (this.isComingBack && distanceFromCentre > settings.worldRadius / 2)
    ) {
      this.isComingBack = true;
      vec2.negate(this.direction, this.center);
      return;
    }
    this.isComingBack = false;

    const nearObjects = this.observe(npcTuning.planScanRadius);
    const enemies = this.enemiesByDistance(nearObjects);

    if (enemies.length > 0) {
      const nearest = enemies[0];
      const fleeRange =
        npcTuning.fleeBaseRange * (npcTuning.fleeAggressionFalloff - this.aggression);
      if (nearest.distance < fleeRange) {
        vec2.subtract(this.direction, this.center, nearest.character.center);
        return;
      }
    }

    if (enemies.length > 0) {
      const nearest = enemies[0];
      const chaseRange =
        npcTuning.chaseBaseRange + npcTuning.chaseAggressionRange * this.aggression;
      if (nearest.distance < chaseRange) {
        vec2.subtract(this.direction, nearest.character.center, this.center);
        return;
      }
    }

    if (!this.isWandering) {
      const planet = this.capturablePlanetsByDistance(nearObjects)[0];
      if (planet) {
        vec2.subtract(this.direction, planet.planet.center, this.center);
        return;
      }
    }

    vec2.rotate(
      this.direction,
      this.direction,
      vec2.create(),
      Random.getRandomInRange(-npcTuning.wanderTurn, npcTuning.wanderTurn),
    );
  }

  private decideMovement(nearObjects: Array<Physical>): vec2 {
    if (this.dodgeCommitRemaining > 0) {
      return vec2.clone(this.dodgeDirection);
    }
    if (this.dodgeCooldownRemaining <= 0) {
      const dodge = this.dodgeVector(nearObjects);
      if (dodge) {
        if (
          Random.getRandom() <
          npcTuning.dodgeBaseChance + npcTuning.dodgeAggressionChance * this.aggression
        ) {
          vec2.copy(this.dodgeDirection, dodge);
          this.dodgeCommitRemaining = npcTuning.dodgeCommitSeconds;
          return vec2.clone(this.dodgeDirection);
        }
        this.dodgeCooldownRemaining = npcTuning.dodgeCooldownSeconds;
      }
    }

    const planet = this.character!.groundPlanet;
    if (planet && planet.team !== this.team) {
      const enemies = this.enemiesByDistance(nearObjects);
      if (
        enemies.length === 0 ||
        enemies[0].distance > npcTuning.captureHoldEnemyDistance
      ) {
        return vec2.create();
      }
    }

    return vec2.normalize(vec2.create(), this.direction);
  }

  private dodgeVector(nearObjects: Array<Physical>): vec2 | undefined {
    let threat: ProjectilePhysical | undefined;
    let threatDistance = Infinity;

    for (const o of nearObjects) {
      const p = o.gameObject;
      if (!(p instanceof ProjectilePhysical) || p.team === this.team || !p.isAlive) {
        continue;
      }
      const toMe = vec2.subtract(vec2.create(), this.center, p.center);
      const distance = vec2.length(toMe);
      if (distance > npcTuning.dodgeThreatRange || distance === 0) {
        continue;
      }
      vec2.normalize(toMe, toMe);
      if (
        vec2.dot(p.direction, toMe) > npcTuning.dodgeApproachDot &&
        distance < threatDistance
      ) {
        threatDistance = distance;
        threat = p;
      }
    }

    if (!threat) {
      return undefined;
    }

    const perpendicular = vec2.fromValues(-threat.direction.y, threat.direction.x);
    const toMe = vec2.subtract(vec2.create(), this.center, threat.center);
    if (vec2.dot(perpendicular, toMe) < 0) {
      vec2.negate(perpendicular, perpendicular);
    }
    vec2.normalize(perpendicular, perpendicular);

    return perpendicular;
  }

  private tryShoot(nearObjects: Array<Physical>) {
    const enemies = this.enemiesByDistance(nearObjects);
    const visible = enemies.find((e) =>
      this.hasLineOfSightTo(e.character.center, nearObjects),
    );
    if (!visible) {
      this.aimTargetId = null;
      return;
    }

    const target = visible.character;
    const distance = visible.distance;

    const velocity = vec2.create();
    if (this.aimTargetId === target.id) {
      vec2.subtract(velocity, target.center, this.aimTargetLastPosition);
      vec2.scale(velocity, velocity, 1 / npcTuning.shootIntervalSeconds);
    }
    this.aimTargetId = target.id;
    vec2.copy(this.aimTargetLastPosition, target.center);

    if (
      Random.getRandom() >
      npcTuning.fireBaseChance + npcTuning.fireAggressionChance * this.aggression
    ) {
      return;
    }

    const charge =
      distance > npcTuning.chargeRangeThreshold &&
      Random.getRandom() <
        npcTuning.chargeBaseChance + npcTuning.chargeAggressionChance * this.aggression
        ? Random.getRandomInRange(npcTuning.chargeMin, 1)
        : 0;

    const projectileSpeed =
      charge > 0 ? settings.chargeShotSpeedMax : settings.chargeShotSpeedMin;
    const leadTime = distance / projectileSpeed;
    const aim = vec2.scaleAndAdd(vec2.create(), target.center, velocity, leadTime);

    const spread =
      (npcTuning.spreadBase + distance * npcTuning.spreadPerDistance) *
      (npcTuning.spreadAggressionFalloff - this.aggression);
    aim.x += Random.getRandomInRange(-spread, spread);
    aim.y += Random.getRandomInRange(-spread, spread);

    this.character!.shootTowards(aim, charge);
  }

  private hasLineOfSightTo(target: vec2, nearObjects: Array<Physical>): boolean {
    const planets: Array<PlanetPhysical> = [];
    for (const o of nearObjects) {
      if (o.gameObject instanceof PlanetPhysical) {
        planets.push(o.gameObject);
      }
    }
    if (planets.length === 0) {
      return true;
    }

    const direction = vec2.subtract(vec2.create(), target, this.center);
    const totalDistance = vec2.length(direction);
    if (totalDistance <= npcTuning.lineOfSightStartOffset) {
      return true;
    }
    vec2.normalize(direction, direction);

    let traveled = npcTuning.lineOfSightStartOffset;
    const position = vec2.scaleAndAdd(vec2.create(), this.center, direction, traveled);
    while (traveled < totalDistance) {
      let sdf = Infinity;
      for (const planet of planets) {
        sdf = Math.min(sdf, planet.distance(position));
      }
      if (sdf < npcTuning.lineOfSightClearance) {
        return false;
      }
      traveled += sdf;
      vec2.scaleAndAdd(position, position, direction, sdf);
    }
    return true;
  }

  private observe(radius: number): Array<Physical> {
    return this.objectContainer.findIntersecting(
      getBoundingBoxOfCircle(new Circle(this.center, radius)),
    );
  }

  private enemiesByDistance(
    nearObjects: Array<Physical>,
  ): Array<{ character: CharacterPhysical; distance: number }> {
    const seen = new Set<CharacterPhysical>();
    const enemies: Array<{ character: CharacterPhysical; distance: number }> = [];
    for (const o of nearObjects) {
      const c = o.gameObject;
      if (
        c instanceof CharacterPhysical &&
        c !== this.character &&
        c.isAlive &&
        c.team !== this.team &&
        !seen.has(c)
      ) {
        seen.add(c);
        enemies.push({ character: c, distance: vec2.distance(this.center, c.center) });
      }
    }
    enemies.sort((a, b) => a.distance - b.distance);
    return enemies;
  }

  private capturablePlanetsByDistance(
    nearObjects: Array<Physical>,
  ): Array<{ planet: PlanetPhysical; distance: number }> {
    const planets = nearObjects
      .filter(
        (o): o is Physical =>
          o.gameObject instanceof PlanetPhysical && o.gameObject.team !== this.team,
      )
      .map((o) => ({
        planet: o.gameObject as PlanetPhysical,
        distance: vec2.distance(this.center, (o.gameObject as PlanetPhysical).center),
      }));
    planets.sort((a, b) => a.distance - b.distance);
    return planets;
  }
}
