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
import { Physical } from '../physics/physicals/physical';

export class NPC extends PlayerBase {
  private direction: vec2 = vec2.fromValues(Random.getRandom(), Random.getRandom());
  private timeSinceLastFindTarget = 10000;
  private timeSinceLastFindShootTarget = 10000;
  private isWandering = false;
  private timeSinceLastWanderingConsideration = 0;
  private isComingBack = false;

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
    if (
      (!this.isComingBack && vec2.length(this.center) > settings.worldRadius) ||
      (this.isComingBack && vec2.length(this.center) > settings.worldRadius / 2)
    ) {
      this.isComingBack = true;
      vec2.subtract(this.direction, vec2.fromValues(0, 0), this.center);
      return;
    }

    this.isComingBack = false;

    const observableArea = getBoundingBoxOfCircle(new Circle(this.center, 2000));
    const nearObjects = this.objectContainer.findIntersecting(observableArea);
    const characters = this.findNearCharactersSorted(nearObjects);

    if (characters.length > 0) {
      const nearest = characters[0];
      if (nearest.distance < 200) {
        vec2.subtract(this.direction, this.center, nearest.character.center);
        return;
      }
    }

    const enemies = characters.filter((o) => o.character.team !== this.team);

    if (enemies.length > 0) {
      const nearest = enemies[0];
      if (nearest.distance < 500) {
        vec2.subtract(this.direction, this.center, nearest.character.center);
        return;
      }
    }

    if (enemies.length > 0) {
      const nearest = enemies[0];
      if (nearest.distance > 1000) {
        vec2.subtract(this.direction, nearest.character.center, this.center);
        return;
      }
    }

    if (this.isWandering) {
      vec2.rotate(
        this.direction,
        this.direction,
        vec2.create(),
        Random.getRandomInRange(-0.2, 0.2),
      );
    } else {
      const planets = this.findNearPlanetsSorted(nearObjects).filter(
        (p) => p.planet.team !== this.team,
      );

      if (planets.length > 0) {
        vec2.subtract(this.direction, planets[0].planet.center, this.center);
      } else {
        this.isWandering = true;
      }
    }
  }

  private findNearCharactersSorted(
    nearObjects: Array<Physical>,
  ): Array<{ character: PlayerCharacterPhysical; distance: number }> {
    const characters = Array.from(
      new Set(
        nearObjects.filter(
          (o) =>
            o.gameObject instanceof PlayerCharacterPhysical &&
            o.gameObject !== this.character,
        ),
      ),
    ).map((c) => ({
      character: c.gameObject,
      distance: vec2.distance(
        this.center,
        (c.gameObject as PlayerCharacterPhysical).center,
      ),
    })) as Array<{ character: PlayerCharacterPhysical; distance: number }>;

    characters.sort((a, b) => a.distance - b.distance);

    return characters;
  }

  private findNearPlanetsSorted(
    nearObjects: Array<Physical>,
  ): Array<{ planet: PlanetPhysical; distance: number }> {
    const planets = nearObjects
      .filter((o) => o.gameObject instanceof PlanetPhysical)
      .map((c) => ({
        planet: c.gameObject,
        distance: vec2.distance(this.center, (c.gameObject as PlanetPhysical).center),
      })) as Array<{ planet: PlanetPhysical; distance: number }>;

    planets.sort((a, b) => a.distance - b.distance);
    return planets;
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

    if ((this.timeSinceLastWanderingConsideration += deltaTimeInSeconds) > 3) {
      this.timeSinceLastWanderingConsideration = 0;
      this.isWandering = Random.getRandom() > 0.5;
    }

    if ((this.timeSinceLastFindTarget += deltaTimeInSeconds) > 1) {
      this.timeSinceLastFindTarget = 0;
      this.findTarget();
    }

    if ((this.timeSinceLastFindShootTarget += deltaTimeInSeconds) > 0.5) {
      if (Random.getRandom() > 0.5) {
        const shootTarget = this.findShootTarget();
        if (shootTarget) {
          vec2.add(
            shootTarget,
            shootTarget,
            vec2.fromValues(
              Random.getRandomInRange(-200, 200),
              Random.getRandomInRange(-200, 200),
            ),
          );
          this.character?.shootTowards(shootTarget);
        }
      }

      this.timeSinceLastFindShootTarget = 0;
    }

    this.character?.handleMovementAction(new MoveActionCommand(this.direction, false));
  }

  protected createCharacter() {
    const randomPoint = vec2.rotate(
      vec2.create(),
      vec2.fromValues(Random.getRandomInRange(0, settings.worldRadius), 0),
      vec2.create(),
      Random.getRandomInRange(0, Math.PI * 2),
    );
    super.createCharacter(randomPoint);
  }
}
