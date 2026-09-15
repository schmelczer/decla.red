import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';

export const evaluateSdf = (target: vec2, objects: Array<Sdf>): number => {
  let minimum = Infinity;
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    if (object.canCollide) {
      minimum = Math.min(minimum, object.distance(target));
    }
  }
  return minimum;
};
