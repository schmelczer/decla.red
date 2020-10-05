import { vec2 } from 'gl-matrix';
import { Command } from '../command';

export class MoveActionCommand extends Command {
  public static readonly type = 'MoveActionCommand';

  public constructor(public readonly delta: vec2) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.delta];
  }
}
