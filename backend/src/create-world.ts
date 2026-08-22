import { vec2 } from 'gl-matrix';
import { Random, PlanetBase, hsl, settings, evaluateSdf } from 'shared';
import { LampPhysical } from './objects/lamp-physical';
import { PlanetPhysical } from './objects/planet-physical';
import { PhysicalContainer } from './physics/containers/physical-container';
import { Physical } from './physics/physicals/physical';

export const createWorld = (objectContainer: PhysicalContainer) => {
  const objects: Array<Physical> = [];
  const lights: Array<Physical> = [];

  for (let r = 0; r < settings.worldRadius; r += settings.radiusSteps) {
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
                  true,
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
  console.info(`Generated ${objects.length} planets`);
  console.info(`Generated ${lights.length} light`);

  // Each lamp is associated with its nearest planet via the planet SDF
  // (negative inside), so it advertises that planet's capture.
  const planets = objects.filter((o): o is PlanetPhysical => o instanceof PlanetPhysical);
  lights
    .filter((l): l is LampPhysical => l instanceof LampPhysical)
    .forEach((lamp) => {
      let nearest: PlanetPhysical | undefined;
      let nearestDistance = Infinity;
      planets.forEach((planet) => {
        const distance = planet.distance(lamp.center);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = planet;
        }
      });
      nearest?.addLamp(lamp);
    });

  [...objects, ...lights].forEach((o) => objectContainer.addObject(o));
};
