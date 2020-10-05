import { Id } from '../transport/identity';

export abstract class Command {
  public get type(): string {
    return (this as any).constructor.type;
  }
}
