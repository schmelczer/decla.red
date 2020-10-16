import { PhysicalBase } from './physical-base';
import { ImmutableBoundingBox } from '../bounding-boxes/immutable-bounding-box';
import { vec2 } from 'gl-matrix';

export interface StaticPhysical extends PhysicalBase {
  readonly canMove: false;
  readonly boundingBox: ImmutableBoundingBox;

  getForce(target: vec2): vec2;
}
