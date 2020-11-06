import { vec2 } from 'gl-matrix';
import { PlanetPhysical } from '../../objects/planet-physical';
import { Physical } from '../physicals/physical';

export const forceAtPosition = (position: vec2, objects: Array<Physical>) =>
  objects
    .filter((o) => o instanceof PlanetPhysical)
    .reduce(
      (sum: vec2, o: Physical) =>
        vec2.add(sum, sum, (o as PlanetPhysical).getForce(position)),
      vec2.create(),
    );
