import { vec2 } from 'gl-matrix';
import { serializable } from '../../transport/serializable/serializable';
import { Command } from '../command';

@serializable()
export class MoveActionCommand extends Command {
  public constructor(public readonly delta: vec2) {
    super();
  }

  public toArray(): Array<any> {
    return [this.delta];
  }
}
