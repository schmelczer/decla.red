import { Renderer } from 'sdf-2d';
import { Command } from 'shared';

export class RenderCommand extends Command {
  public static readonly type = 'RenderCommand';

  public constructor(public readonly renderer: Renderer) {
    super();
  }
}
