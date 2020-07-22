import { Command } from '../command';
import { vec2 } from 'gl-matrix';

export class SecondaryActionCommand extends Command {
  public constructor(public readonly position?: vec2) {
    super();
  }
}
