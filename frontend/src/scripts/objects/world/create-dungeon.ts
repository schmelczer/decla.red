import { vec2, vec3 } from 'gl-matrix';
import { Objects } from '../objects';
import { Tunnel } from '../types/tunnel';
import { Physics } from '../../physics/physics';
import { GameObject } from '../game-object';

export const createDungeon = (objects: Objects, physics: Physics): Tunnel => {
  let previousRadius = 350;
  let previousEnd = vec2.create();

  let first: Tunnel;

  for (let i = 0; i < 1; i += 500) {
    const deltaHeight = (Math.random() - 0.5) * 2000;
    const height = previousEnd.y + deltaHeight;
    const currentEnd = vec2.fromValues(i, height);
    const currentToRadius = Math.random() * 300 + 150;

    const tunnel = new Tunnel(
      physics,
      previousEnd,
      currentEnd,
      previousRadius,
      currentToRadius
    );

    if (!first) {
      first = tunnel;
    }

    objects.addObject(tunnel);

    /*if (deltaHeight > 0 && Math.random() > 0.8) {
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
    }*/

    previousEnd = currentEnd;
    previousRadius = currentToRadius;
  }

  return first;
};
