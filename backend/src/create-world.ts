import { vec2 } from 'gl-matrix';
import { Random, PlanetBase, hsl, settings, evaluateSdf } from 'shared';
import { LampPhysical } from './objects/lamp-physical';
import { PlanetPhysical } from './objects/planet-physical';
import { PhysicalContainer } from './physics/physical-container';

export const createWorld = (objectContainer: PhysicalContainer) => {
  const planets: Array<PlanetPhysical> = [];
  const lamps: Array<LampPhysical> = [];

  for (let r = 0; r < settings.worldRadius; r += settings.radiusSteps) {
    const stepCount = 2 * Math.PI * r * settings.objectsOnCircleLength;
    for (let rad = 0; rad < 2 * Math.PI; rad += (2 * Math.PI) / stepCount) {
      const position = vec2.rotate(
        vec2.create(),
        vec2.fromValues(r, 0),
        vec2.create(),
        rad,
      );

      if (planets.length !== 0 && Random.getRandom() > 0.5) {
        if (
          evaluateSdf(position, planets) > 200 &&
          !lamps.find((l) => l.distance(position) < 2500)
        ) {
          lamps.push(
            new LampPhysical(
              position,
              hsl(
                (rad / (2 * Math.PI)) * 360,
                Random.getRandomInRange(50, 100),
                Random.getRandomInRange(40, 50),
              ),
              Random.getRandomInRange(0.35, 1),
            ),
          );
        }
      } else if (
        evaluateSdf(position, planets) > 1400 &&
        !lamps.find((l) => l.distance(position) < 1700)
      ) {
        const isKeystone = planets.length === 0;
        const [sizeMin, sizeMax, roughMin, roughMax] = isKeystone
          ? [1600, 2400, 80, 300]
          : [300, 1600, 20, 100];
        planets.push(
          new PlanetPhysical(
            PlanetBase.createPlanetVertices(
              position,
              Random.getRandomInRange(sizeMin, sizeMax),
              Random.getRandomInRange(sizeMin, sizeMax),
              Random.getRandomInRange(roughMin, roughMax),
            ),
            isKeystone,
            objectContainer.game,
          ),
        );
      }
    }
  }
  console.info(`Generated ${planets.length} planets and ${lamps.length} lamps`);

  for (const lamp of lamps) {
    let nearest: PlanetPhysical | undefined;
    let nearestDistance = Infinity;
    for (const planet of planets) {
      const distance = planet.distance(lamp.center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = planet;
      }
    }
    nearest?.addLamp(lamp);
  }

  [...planets, ...lamps].forEach((o) => objectContainer.addObject(o));
};
