import { vec2, vec3 } from 'gl-matrix';
import { Random } from '../../helper/random';
import { Physics } from '../../physics/physics';
import { Objects } from '../objects';
import { Lamp } from '../types/lamp';
import { Tunnel } from '../types/tunnel';

export const createDungeon = (objects: Objects, physics: Physics) => {
  let previousRadius = 350;
  let previousEnd = vec2.create();

  let tunnelsCountSinceLastLight = 0;

  for (let i = 0; i < 500000; i += 500) {
    const deltaHeight = (Random.getRandom() - 0.5) * 2000;
    const height = previousEnd.y + deltaHeight;
    const currentEnd = vec2.fromValues(i, height);
    const currentToRadius = Random.getRandom() * 300 + 150;

    const tunnel = new Tunnel(
      physics,
      previousEnd,
      currentEnd,
      previousRadius,
      currentToRadius
    );

    objects.addObject(tunnel);

    if (++tunnelsCountSinceLastLight > 3 && Random.getRandom() > 0.7) {
      objects.addObject(
        new Lamp(
          currentEnd,
          vec3.normalize(
            vec3.create(),
            vec3.fromValues(Random.getRandom(), 0, Random.getRandom())
          ),
          0.5,
          physics
        )
      );
      tunnelsCountSinceLastLight = 0;
    }

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }
};
