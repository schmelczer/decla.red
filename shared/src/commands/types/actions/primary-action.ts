import { vec2 } from 'gl-matrix';
import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class PrimaryActionCommand extends Command {
  public constructor(
    public readonly position: vec2,
    public readonly charge: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.position, this.charge];
  }
}
