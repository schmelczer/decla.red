import { UpdateMessage, UpdateObjectMessage } from '../main';
import { Id } from '../transport/identity';

export abstract class GameObject {
  constructor(public readonly id: Id) {}

  public calculateUpdates(): UpdateObjectMessage | undefined {
    return;
  }

  update(updates: Array<UpdateMessage>): void {
    updates.forEach((u) => ((this as any)[u.key] = u.value));
  }
}
