import { PhysicalBase } from './physical-base';
import { ImmutableBoundingBox } from '../bounding-boxes/immutable-bounding-box';

export interface StaticPhysical extends PhysicalBase {
  readonly canMove: false;
  readonly boundingBox: ImmutableBoundingBox;
}
