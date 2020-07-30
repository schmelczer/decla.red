import { vec2 } from 'gl-matrix';
import { Command } from '../../commands/command';

export class MoveToCommand extends Command {
  public constructor(public readonly position?: vec2) {
    super();
  }

  public get type(): string {
    return 'MoveToCommand';
  }
}
