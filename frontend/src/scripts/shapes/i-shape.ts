import { BoundingBox } from './bounding-box';
import { vec2 } from 'gl-matrix';

export interface IShape {
  readonly isInverted: boolean;
  readonly boundingBox: BoundingBox;

  distance(target: vec2): number;
  normal(from: vec2): vec2;

  clone(): IShape;
}
