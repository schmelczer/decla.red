import { Renderer } from 'sdf-2d';
import { Command } from 'shared';

export class RenderCommand extends Command {
  public constructor(public readonly renderer: Renderer) {
    super();
  }
}
