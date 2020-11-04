import { vec2 } from 'gl-matrix';
import { Random, PlanetBase, hsl, settings } from 'shared';
import { LampPhysical } from './objects/lamp-physical';
import { PlanetPhysical } from './objects/planet-physical';
import { PhysicalContainer } from './physics/containers/physical-container';
import { evaluateSdf } from './physics/functions/evaluate-sdf';
import { Physical } from './physics/physicals/physical';

export const createWorld = (objectContainer: PhysicalContainer, worldRadius: number) => {
  const objects: Array<Physical> = [];
  const lights: Array<Physical> = [];

  for (let r = 0; r < worldRadius; r += settings.radiusSteps) {
    const circumference = 2 * Math.PI * r;
    const stepCount = circumference * settings.objectsOnCircleLength;
    for (let rad = 0; rad < 2 * Math.PI; rad += (2 * Math.PI) / stepCount) {
      const position = vec2.rotate(
        vec2.create(),
        vec2.fromValues(r, 0),
        vec2.create(),
        rad,
      );

      if (objects.length !== 0 && Random.getRandom() > 0.5) {
        if (
          evaluateSdf(position, objects) > 200 &&
          !lights.find((l) => l.distance(position) < 2500)
        ) {
          lights.push(
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
      } else {
        if (
          evaluateSdf(position, objects) > 1400 &&
          !lights.find((l) => l.distance(position) < 1700)
        ) {
          const planet =
            objects.length === 0
              ? new PlanetPhysical(
                  PlanetBase.createPlanetVertices(
                    position,
                    Random.getRandomInRange(1600, 2400),
                    Random.getRandomInRange(1600, 2400),
                    Random.getRandomInRange(80, 300),
                  ),
                )
              : new PlanetPhysical(
                  PlanetBase.createPlanetVertices(
                    position,
                    Random.getRandomInRange(300, 1600),
                    Random.getRandomInRange(300, 1600),
                    Random.getRandomInRange(20, 100),
                  ),
                );

          objects.push(planet);
        }
      }
    }
  }
  console.info('Generated planet count', objects.length);
  console.info('Generated light count', lights.length);

  [...objects, ...lights].forEach((o) => objectContainer.addObject(o));
};
