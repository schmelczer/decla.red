import { vec2 } from 'gl-matrix';
import { GameObject } from 'shared';
import { BoundingBox } from './bounding-box';

export interface Physical {
  readonly canCollide: boolean;
  readonly boundingBox: BoundingBox;
  readonly gameObject: GameObject;

  distance(target: vec2): number;
  step?(deltaTimeInSeconds: number): void;
  onCollision?(other: GameObject): void;
}
