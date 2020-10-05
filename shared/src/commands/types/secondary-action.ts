import { vec2 } from 'gl-matrix';
import { Command } from '../command';

export class SecondaryActionCommand extends Command {
  public static readonly type = 'SecondaryActionCommand';

  public constructor(public readonly position: vec2) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.position];
  }
}
