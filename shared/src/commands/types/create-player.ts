import { Command } from '../command';

export class CreatePlayerCommand extends Command {
  public constructor(public readonly serializedPlayer: string) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.serializedPlayer];
  }
}
