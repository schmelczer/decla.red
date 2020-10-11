import { vec2, vec3 } from 'gl-matrix';
import { Random } from 'shared';
import { LampPhysical } from '../objects/lamp-physical';

import { TunnelPhysical } from '../objects/tunnel-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';

export const createDungeon = (objects: PhysicalContainer) => {
  const lightPositions: Array<vec2> = [];

  for (let j = 0; j < 6; j++) {
    let previousRadius = 500;
    let previousEnd = vec2.fromValues(
      j === 0 ? 0 : Random.getRandomInRange(-1000, 1000),
      j === 0 ? 0 : Random.getRandomInRange(-1000, 1000),
    );
    for (let i = 0; i < 500; i++) {
      const delta = vec2.fromValues(j % 2 ? 1 : -1, Random.getRandomInRange(-1, 1));

      vec2.normalize(delta, delta);
      vec2.scale(delta, delta, 500);

      const currentEnd = vec2.add(delta, delta, previousEnd);

      const currentToRadius = Random.getRandom() * 250 + 150;

      const tunnel = new TunnelPhysical(
        previousEnd,
        currentEnd,
        previousRadius,
        currentToRadius,
      );

      objects.addObject(tunnel);

      if (Random.getRandom() > 0.7) {
        const position = currentEnd;
        if (!lightPositions.find((p) => vec2.dist(p, position) < 2000)) {
          lightPositions.push(position);
          objects.addObject(
            new LampPhysical(
              currentEnd,
              vec3.normalize(
                vec3.create(),
                vec3.fromValues(
                  Random.getRandomInRange(0.5, 1),
                  0,
                  Random.getRandomInRange(0.5, 1),
                ),
              ),
              Random.getRandomInRange(0.5, 1),
            ),
          );
        }
      }

      previousEnd = currentEnd;
      previousRadius = currentToRadius;
    }
  }
};
