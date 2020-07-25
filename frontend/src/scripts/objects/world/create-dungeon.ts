import { vec2, vec3 } from 'gl-matrix';
import { ObjectContainer } from '../object-container';
import { CircleLight } from '../types/circle-light';
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

    if (deltaHeight > 0) {
      objects.addObject(
        new CircleLight(
          currentEnd,
          Math.random() * 20 + 30,
          vec3.scale(
            vec3.create(),
            vec3.normalize(vec3.create(), vec3.random(vec3.create())),
            Math.random() * 0.5 + 0.5
          )
        )
      );
    }

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }
};
