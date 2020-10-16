import { vec2 } from 'gl-matrix';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class MoveActionCommand extends Command {
  public constructor(
    public readonly direction: vec2,
    public readonly isCharacterRelative: boolean,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.direction, this.isCharacterRelative];
  }
}
