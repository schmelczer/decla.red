import { vec2 } from 'gl-matrix';
import { exertsForce } from '../../objects/capabilities/exerts-force';
import { Physical } from '../physicals/physical';

export const forceAtPosition = (position: vec2, objects: Array<Physical>) =>
  objects.reduce(
    (sum: vec2, o: Physical) =>
      exertsForce(o) ? vec2.add(sum, sum, o.getForce(position)) : sum,
    vec2.create(),
  );
