import { IRenderer } from '../../drawing/i-renderer';
import { Command } from '../command';

export class RenderCommand extends Command {
  public constructor(public readonly renderer?: IRenderer) {
    super();
  }
}
