import { vec2, vec3 } from 'gl-matrix';
import { Random } from 'shared';
import { LampPhysics } from '../objects/lamp-physics';
import { TunnelPhysics } from '../objects/tunnel-physics';
import { PhysicalGameObjectContainer } from '../physics/physical-game-object-container';

export const createDungeon = (objects: PhysicalGameObjectContainer) => {
  let previousRadius = 350;
  let previousEnd = vec2.create();

  let tunnelsCountSinceLastLight = 0;

  for (let i = 0; i < 500000; i += 500) {
    const deltaHeight = (Random.getRandom() - 0.5) * 2000;
    const height = previousEnd.y + deltaHeight;
    const currentEnd = vec2.fromValues(i, height);
    const currentToRadius = Random.getRandom() * 300 + 150;

    const tunnel = new TunnelPhysics(
      previousEnd,
      currentEnd,
      previousRadius,
      currentToRadius
    );

    objects.addObject(tunnel, false);

    if (++tunnelsCountSinceLastLight > 3 && Random.getRandom() > 0.7) {
      objects.addObject(
        new LampPhysics(
          currentEnd,
          vec3.normalize(
            vec3.create(),
            vec3.fromValues(Random.getRandom(), 0, Random.getRandom())
          ),
          0.5
        ),
        false
      );
      tunnelsCountSinceLastLight = 0;
    }

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }
};
