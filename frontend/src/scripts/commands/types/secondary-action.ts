import { Command } from '../command';
import { Vec2 } from '../../math/vec2';

export class SecondaryActionCommand extends Command {
  public constructor(public readonly position: Vec2) {
    super();
  }
}
