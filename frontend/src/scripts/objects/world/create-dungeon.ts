import { vec2, vec3 } from 'gl-matrix';
import { ObjectContainer } from '../object-container';
import { Lamp } from '../types/lamp';
import { Tunnel } from '../types/tunnel';

export const createDungeon = (objects: ObjectContainer) => {
  let previousRadius = 350;
  let previousEnd = vec2.create();

  for (let i = 0; i < 500000; i += 500) {
    const deltaHeight = (Math.random() - 0.5) * 2000;
    const height = previousEnd.y + deltaHeight;
    const currentEnd = vec2.fromValues(i, height);
    const currentToRadius = Math.random() * 300 + 150;

    objects.addObject(
      new Tunnel(previousEnd, currentEnd, previousRadius, currentToRadius)
    );

    if (deltaHeight > 0 && Math.random() > 0.8) {
      objects.addObject(
        new Lamp(
          currentEnd,
          Math.random() * 20 + 30,
          vec3.scale(
            vec3.create(),
            vec3.normalize(vec3.create(), vec3.fromValues(0.5, 0.1, 0.8)),
            Math.random() * 0.5 + 0.5
          ),
          1
        )
      );
    }

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }
};
