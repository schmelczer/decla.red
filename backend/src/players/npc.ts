import { vec2 } from 'gl-matrix';
import {
  PlayerInformation,
  CharacterTeam,
  settings,
  Circle,
  Random,
  MoveActionCommand,
} from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlayerContainer } from './player-container';
import { PlayerBase } from './player-base';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { PlayerCharacterPhysical } from '../objects/player-character-physical';
import { PlanetPhysical } from '../objects/planet-physical';

export class NPC extends PlayerBase {
  private moveTarget: vec2 = vec2.create();
  private planet?: PlanetPhysical;
  private timeSinceLastFindTarget = 10000;
  private timeSinceLastFindShootTarget = 10000;

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

  private findTarget() {
    const observableArea = getBoundingBoxOfCircle(new Circle(this.center, 100));
    const nearObjects = this.objectContainer.findIntersecting(observableArea);

    const enemies = nearObjects.filter(
      (o) =>
        o.gameObject instanceof PlayerCharacterPhysical &&
        o.gameObject.team !== this.team,
    );
    const allies = nearObjects.filter(
      (o) =>
        o.gameObject instanceof PlayerCharacterPhysical &&
        o.gameObject.team === this.team,
    );
    const notControlledPlanets = nearObjects.filter(
      (o) => o.gameObject instanceof PlanetPhysical && o.gameObject.team !== this.team,
    );

    if (enemies.length > allies.length) {
      const enemiesCenter = enemies.reduce(
        (sum, e) => vec2.add(sum, sum, (e.gameObject as PlayerCharacterPhysical).center),
        vec2.create(),
      );
      vec2.scale(enemiesCenter, enemiesCenter, 1 / enemies.length);
      const enemiesDelta = vec2.subtract(enemiesCenter, this.center, enemiesCenter);
      if (vec2.length(enemiesDelta) > 0) {
        vec2.scale(enemiesDelta, enemiesDelta, 200 / vec2.length(enemiesDelta));
      }
      vec2.add(this.moveTarget, this.center, enemiesDelta);
    } else if (!this.planet) {
      if (notControlledPlanets.length > 0) {
        this.planet = notControlledPlanets[0] as PlanetPhysical;
        this.moveTarget = this.planet.center;
      } else {
        this.moveTarget = vec2.fromValues(
          Random.getRandomInRange(-5000, 5000),
          Random.getRandomInRange(-5000, 5000),
        );
      }
    }
  }

  private findShootTarget(): vec2 | undefined {
    const observableArea = getBoundingBoxOfCircle(new Circle(this.center, 1000));
    const nearObjects = this.objectContainer.findIntersecting(observableArea);

    const enemies = nearObjects.filter(
      (o) =>
        o.gameObject instanceof PlayerCharacterPhysical &&
        o.gameObject.team !== this.team,
    );
    if (enemies.length > 0) {
      return (enemies[0].gameObject as PlayerCharacterPhysical).center;
    }
  }

  private timeUntilRespawn = 0;
  public step(deltaTimeInSeconds: number) {
    if (this.character) {
      this.center = this.character?.center;

      if (!this.character.isAlive) {
        this.sumDeaths++;
        this.sumKills = this.character.killCount;

        this.character = null;
        this.timeUntilRespawn = settings.playerDiedTimeout;
      }
    } else {
      if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
        this.createCharacter();
        this.center = this.character!.center;
      }
    }

    if (this.planet && Math.abs(this.planet.ownership - 0.5) > 0.3) {
      this.planet = undefined;
      this.findTarget();
    } else {
      if ((this.timeSinceLastFindTarget += deltaTimeInSeconds) > 1) {
        this.timeSinceLastFindTarget = 0;
        this.findTarget();
      }
    }

    if ((this.timeSinceLastFindShootTarget += deltaTimeInSeconds) > 0.5) {
      const shootTarget = this.findShootTarget();
      if (shootTarget) {
        this.character?.shootTowards(shootTarget);
      }
      this.timeSinceLastFindShootTarget = 0;
    }

    const targetDelta = vec2.subtract(vec2.create(), this.moveTarget, this.center);
    vec2.normalize(targetDelta, targetDelta);
    this.character?.handleMovementAction(new MoveActionCommand(targetDelta, false));
  }
}
