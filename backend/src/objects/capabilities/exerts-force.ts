import { vec2 } from 'gl-matrix';

export interface ExertsForce {
  getForce(target: vec2): vec2;
}

export const exertsForce = (a: any): a is ExertsForce => a && 'getForce' in a;
