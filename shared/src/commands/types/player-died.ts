import { vec2 } from 'gl-matrix';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class PlayerDiedCommand extends Command {
  public constructor(public readonly timeout: number) {
    super();
  }

  public toArray(): Array<any> {
    return [this.timeout];
  }
}
