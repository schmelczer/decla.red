import { vec2 } from 'gl-matrix';
import { GameObject } from '../objects/game-object';
import { BoundingBox } from './bounding-box';

export interface IShape {
  readonly boundingBox: BoundingBox;
  readonly gameObject?: GameObject;

  minDistance(target: vec2): number;
  normal(from: vec2): vec2;
  clone(): IShape;
}
