import { CommandReceiver } from '../commands/command-receiver';
import { Id } from '../transport/identity';

export abstract class GameObject extends CommandReceiver {
  public static get type(): string {
    return (this as any).name;
  }

  public get type(): string {
    return (this as any).constructor.name;
  }

  constructor(public readonly id: Id) {
    super();
  }
}
