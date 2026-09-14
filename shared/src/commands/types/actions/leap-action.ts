import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class LeapActionCommand extends Command {
  public constructor(public readonly clientTimeMs: number) {
    super();
  }

  public toArray(): Array<any> {
    return [this.clientTimeMs];
  }
}
