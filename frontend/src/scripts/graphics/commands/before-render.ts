import { Command } from '../../commands/command';
import { IRenderer } from '../i-renderer';

export class BeforeRenderCommand extends Command {
  public constructor(public readonly renderer?: IRenderer) {
    super();
  }

  public get type(): string {
    return 'BeforeRenderCommand';
  }
}
