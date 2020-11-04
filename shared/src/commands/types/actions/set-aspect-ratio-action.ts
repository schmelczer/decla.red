import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class SetAspectRatioActionCommand extends Command {
  public constructor(public readonly aspectRatio: number) {
    super();
  }

  public toArray(): Array<any> {
    return [this.aspectRatio];
  }
}
