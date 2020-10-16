import { vec2 } from 'gl-matrix';
import { Physical } from '../physicals/physical';

export const forceAtPosition = (position: vec2, objects: Array<Physical>) =>
  objects.reduce(
    (sum: vec2, o: Physical) =>
      !o.canMove ? vec2.add(sum, sum, o.getForce(position)) : sum,
    vec2.create(),
  );
