import { IRenderer } from '../../drawing/i-renderer';
import { Command } from '../command';

export class BeforeDrawCommand extends Command {
  public constructor(public readonly drawer?: IRenderer) {
    super();
  }
}
