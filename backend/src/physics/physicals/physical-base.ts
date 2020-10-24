import { vec2 } from 'gl-matrix';
import { GameObject } from 'shared';
import { BoundingBoxBase } from '../bounding-boxes/bounding-box-base';

export interface PhysicalBase {
  readonly canCollide: boolean;
  readonly canMove: boolean;
  readonly boundingBox: BoundingBoxBase;
  readonly gameObject: GameObject;

  distance(target: vec2): number;
  step(deltaTimeInMilliseconds: number): void;
}
