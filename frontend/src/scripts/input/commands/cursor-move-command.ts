import { Command } from '../../commands/command';
import { vec2 } from 'gl-matrix';

export class CursorMoveCommand extends Command {
  public constructor(public readonly position?: vec2) {
    super();
  }

  public get type(): string {
    return 'CursorMoveCommand';
  }
}
