import { BoundingBoxBase } from './physics/bounds/bounding-box-base';

export interface IGame {
  readonly viewArea: BoundingBoxBase;
  findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase>;
}
