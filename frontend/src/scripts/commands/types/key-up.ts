import { Command } from '../command';

export class KeyUpCommand extends Command {
  public constructor(public readonly key?: string) {
    super();
  }
}
