import { vec2 } from 'gl-matrix';
import { BoundingBox } from './bounding-box';
import { GameObject } from '../objects/game-object';

export interface IShape {
  readonly isInverted: boolean;
  readonly boundingBox: BoundingBox;

  readonly gameObject?: GameObject;

  distance(target: vec2): number;
  normal(from: vec2): vec2;

  clone(): IShape;
}
