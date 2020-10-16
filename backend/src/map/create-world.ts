import { vec2, vec3 } from 'gl-matrix';
import { Random, settings, PlanetBase } from 'shared';
import { LampPhysical } from '../objects/lamp-physical';
import { PlanetPhysical } from '../objects/planet-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { evaluateSdf } from '../physics/functions/evaluate-sdf';
import { Physical } from '../physics/physicals/physical';

export const createWorld = (objectContainer: PhysicalContainer) => {
  const objects: Array<Physical> = [];
  const lights: Array<Physical> = [];

  const worldSize = vec2.length(
    vec2.fromValues(
      settings.worldTopEdge - settings.worldBottomEdge,
      settings.worldRightEdge - settings.worldLeftEdge,
    ),
  );

  for (let i = 0; i < worldSize / 400; i++) {
    console.log('planet', i);

    let position: vec2;

    do {
      position = vec2.fromValues(
        Random.getRandomInRange(settings.worldLeftEdge, settings.worldRightEdge),
        Random.getRandomInRange(settings.worldBottomEdge, settings.worldTopEdge),
      );
    } while (
      evaluateSdf(position, objects) < 800 ||
      evaluateSdf(position, objects) > 2500
    );

    objects.push(
      new PlanetPhysical(
        PlanetBase.createPlanetVertices(
          position,
          Random.getRandomInRange(300, 800),
          Random.getRandomInRange(300, 800),
          Random.getRandomInRange(20, 40),
        ),
      ),
    );
  }

  for (let i = 0; i < worldSize / 350; i++) {
    console.log('light', i);
    let position: vec2;
    do {
      position = vec2.fromValues(
        Random.getRandomInRange(settings.worldLeftEdge, settings.worldRightEdge),
        Random.getRandomInRange(settings.worldBottomEdge, settings.worldTopEdge),
      );
    } while (
      evaluateSdf(position, objects) < 200 ||
      lights.find((l) => l.distance(position) < 1800)
    );
    lights.push(
      new LampPhysical(
        position,
        vec3.normalize(
          vec3.create(),
          vec3.fromValues(
            Random.getRandomInRange(0.5, 1),
            0,
            Random.getRandomInRange(0.5, 1),
          ),
        ),
        Random.getRandomInRange(0.25, 1),
      ),
    );
  }

  [...objects, ...lights].forEach((o) => objectContainer.addObject(o));
};
