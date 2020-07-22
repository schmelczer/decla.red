import { Command } from '../command';
import { vec2 } from 'gl-matrix';

export class SwipeCommand extends Command {
  public constructor(public readonly delta?: vec2) {
    super();
  }
}
