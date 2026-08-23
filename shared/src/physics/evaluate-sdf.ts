import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';

export const evaluateSdf = (target: vec2, objects: Array<Sdf>): number => {
  let minimum = 1000000;
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    if (object.canCollide) {
      minimum = Math.min(minimum, object.distance(target));
    }
  }
  return minimum;
};
