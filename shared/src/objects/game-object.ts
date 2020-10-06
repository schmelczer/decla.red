import { CommandReceiver } from '../commands/command-receiver';
import { Id } from '../transport/identity';

export abstract class GameObject extends CommandReceiver {
  constructor(public readonly id: Id) {
    super();
  }
}
