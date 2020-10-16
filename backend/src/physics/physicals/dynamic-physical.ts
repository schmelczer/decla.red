import { PhysicalBase } from './physical-base';

export interface DynamicPhysical extends PhysicalBase {
  readonly canMove: true;
  step(deltaTimeInMilliseconds: number): void;
}
