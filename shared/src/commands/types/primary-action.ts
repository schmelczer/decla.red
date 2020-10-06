import { vec2 } from 'gl-matrix';
import { Command } from '../command';

export class PrimaryActionCommand extends Command {
  public constructor(public readonly position: vec2) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.position];
  }
}
