import { UpdateObjectMessage } from 'shared/lib/src/objects/update-object-message';
import { PhysicalBase } from './physical-base';

export interface DynamicPhysical extends PhysicalBase {
  readonly canMove: true;
  step(deltaTimeInMilliseconds: number): void;

  calculateUpdates(): UpdateObjectMessage | null;
}
