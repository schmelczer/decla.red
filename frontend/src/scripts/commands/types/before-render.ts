import { Command } from '../command';
import { IRenderer } from '../../drawing/i-renderer';

export class BeforeRenderCommand extends Command {
  public constructor(public readonly renderer?: IRenderer) {
    super();
  }

  public get type(): string {
    return 'BeforeRenderCommand';
  }
}
