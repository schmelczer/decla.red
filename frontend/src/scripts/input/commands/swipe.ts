import { vec2 } from 'gl-matrix';
import { Command } from '../../commands/command';

export class SwipeCommand extends Command {
  public constructor(public readonly delta?: vec2) {
    super();
  }

  public get type(): string {
    return 'SwipeCommand';
  }
}
