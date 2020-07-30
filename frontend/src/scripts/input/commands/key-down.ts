import { Command } from '../../commands/command';

export class KeyDownCommand extends Command {
  public constructor(public readonly key?: string) {
    super();
  }

  public get type(): string {
    return 'KeyDownCommand';
  }
}
