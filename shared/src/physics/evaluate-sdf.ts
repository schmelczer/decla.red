import { vec2 } from 'gl-matrix';
import { Sdf } from './sdf';

// Distance to the nearest collidable surface. This is the innermost leaf of the
// whole physics stack — every raymarch step, every depenetration pass and four
// times per surface normal — so it is a plain indexed loop rather than
// filter().reduce(), which allocated an intermediate array per call.
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
