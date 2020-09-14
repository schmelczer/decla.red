import { Command } from '../../commands/command';
import { IRenderer } from '../../graphics/i-renderer';

export class RenderCommand extends Command {
  public constructor(public readonly renderer?: IRenderer) {
    super();
  }

  public get type(): string {
    return 'RenderCommand';
  }
}
