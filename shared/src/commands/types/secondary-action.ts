import { vec2 } from 'gl-matrix';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class SecondaryActionCommand extends Command {
  public constructor(public readonly position: vec2) {
    super();
  }

  public toArray(): Array<any> {
    return [this.position];
  }
}
