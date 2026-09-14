import { GameObject, Sdf } from 'shared';
import { BoundingBox } from './bounding-box';

export interface Physical extends Sdf {
  readonly boundingBox: BoundingBox;
  readonly gameObject: GameObject;

  step?(deltaTimeInSeconds: number): void;
  onCollision?(other: GameObject): void;
}
