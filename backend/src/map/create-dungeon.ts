import { vec2, vec3 } from 'gl-matrix';
import { Random } from 'shared';
import { LampPhysical } from '../objects/lamp-physical';
import { TunnelPhysical } from '../objects/tunnel-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';

export const createDungeon = (objects: PhysicalContainer) => {
  let previousRadius = 350;
  let previousEnd = vec2.create();

  let tunnelsCountSinceLastLight = 0;

  for (let i = 0; i < 50000; i += 500) {
    const deltaHeight = (Random.getRandom() - 0.5) * 500;
    const height = previousEnd.y + deltaHeight;
    const currentEnd = vec2.fromValues(i, height);
    const currentToRadius = Random.getRandom() * 300 + 150;

    const tunnel = new TunnelPhysical(
      previousEnd,
      currentEnd,
      previousRadius,
      currentToRadius,
    );

    objects.addObject(tunnel);

    if (++tunnelsCountSinceLastLight > 3 && Random.getRandom() > 0.7) {
      objects.addObject(
        new LampPhysical(
          currentEnd,
          vec3.normalize(
            vec3.create(),
            vec3.fromValues(Random.getRandom(), 0, Random.getRandom()),
          ),
          0.5,
        ),
      );
      tunnelsCountSinceLastLight = 0;
    }

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }
};
