import { Physical } from '../physical';
import { ImmutableBoundingBox } from '../bounding-boxes/immutable-bounding-box';

export interface StaticPhysical extends Physical {
  readonly boundingBox: ImmutableBoundingBox;
}
