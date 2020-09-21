import { Renderer } from 'sdf-2d';
import { Command } from '../../commands/command';

export class RenderCommand extends Command {
  public constructor(public readonly renderer?: Renderer) {
    super();
  }

  public get type(): string {
    return 'RenderCommand';
  }
}
