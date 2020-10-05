import { CommandReceiver } from '../commands/command-receiver';
import { Id } from '../transport/identity';

export abstract class GameObject extends CommandReceiver {
  public get type(): string {
    return (this as any).constructor.type;
  }

  constructor(public readonly id: Id) {
    super();
  }
}
