import { GameObject } from 'shared';
import { BoundingBoxBase } from './bounds/bounding-box-base';

export interface PhysicalGameObject extends GameObject {
  getBoundingBox(): BoundingBoxBase;
  //distance(target: vec2): number;
  readonly isInverted: boolean;
  readonly canCollide: boolean;
  readonly canMove: boolean;
}
