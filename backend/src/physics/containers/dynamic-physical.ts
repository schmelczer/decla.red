import { Physical } from '../physical';

export interface DynamicPhysical extends Physical {
  step(deltaTimeInMilliseconds: number): void;
}
