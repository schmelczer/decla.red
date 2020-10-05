import { vec2 } from 'gl-matrix';
import { Command } from 'shared';

export class MoveToCommand extends Command {
  public static readonly type = 'MoveToCommand';

  public constructor(public readonly position: vec2) {
    super();
  }
}
