import { IRenderer } from '../../drawing/i-renderer';
import { Command } from '../../commands/command';

export class RenderCommand extends Command {
  public constructor(public readonly renderer?: IRenderer) {
    super();
  }

  public get type(): string {
    return 'RenderCommand';
  }
}
