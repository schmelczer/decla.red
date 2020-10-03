import { vec2 } from 'gl-matrix';
import { Command } from './command';

export class TeleportToCommand extends Command {
  public constructor(public readonly position?: vec2) {
    super();
  }

  public get type(): string {
    return 'TeleportToCommand';
  }
}
