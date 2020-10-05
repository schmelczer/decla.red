import { vec2 } from 'gl-matrix';
import { Command } from '../command';

export class PrimaryActionCommand extends Command {
  public static readonly type = 'PrimaryActionCommand';

  public constructor(public readonly position: vec2) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.position];
  }
}
