import { vec2 } from 'gl-matrix';
import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class MoveActionCommand extends Command {
  public constructor(public readonly direction: vec2) {
    super();
  }

  public toArray(): Array<any> {
    return [this.direction];
  }
}
