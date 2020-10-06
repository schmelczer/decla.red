import { Rectangle } from '../../helper/rectangle';
import { Command } from '../command';

export class SetViewAreaActionCommand extends Command {
  public constructor(public readonly viewArea: Rectangle) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.viewArea];
  }
}
