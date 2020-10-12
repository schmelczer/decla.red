import { GameObject } from 'shared';
import { Physical } from '../physical';

export interface DynamicPhysical extends Physical {
  readonly canMove: true;
  step(deltaTimeInMilliseconds: number): void;
  onCollision(other: GameObject): void;
}
