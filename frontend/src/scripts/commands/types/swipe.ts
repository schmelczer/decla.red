import { Command } from '../command';
import { Vec2 } from '../../math/vec2';

export class SwipeCommand extends Command {
  public constructor(public readonly delta?: Vec2) {
    super();
  }
}
