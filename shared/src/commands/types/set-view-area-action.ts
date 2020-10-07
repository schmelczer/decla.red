import { Rectangle } from '../../helper/rectangle';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class SetViewAreaActionCommand extends Command {
  public constructor(public readonly viewArea: Rectangle) {
    super();
  }

  public toArray(): Array<any> {
    return [this.viewArea];
  }
}
