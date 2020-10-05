import { vec2 } from 'gl-matrix';
import { Command } from '../command';

export class TernaryActionCommand extends Command {
  public static readonly type = 'TernaryActionCommand';

  public constructor(public readonly position: vec2) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.position];
  }
}
