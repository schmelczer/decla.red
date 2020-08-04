import { BoundingBoxBase } from './bounding-box-base';
import { IPrimitive } from '../../drawing/drawables/primitives/i-primitive';

export class ImmutableBoundingBox extends BoundingBoxBase {
  constructor(
    value: IPrimitive,
    xMin: number = 0,
    xMax: number = 0,
    yMin: number = 0,
    yMax: number = 0
  ) {
    super(value, xMin, xMax, yMin, yMax);
  }
}
