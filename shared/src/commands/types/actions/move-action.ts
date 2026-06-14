import { vec2 } from 'gl-matrix';
import { serializable } from '../../../serialization/serializable';
import { Command } from '../../command';

@serializable
export class MoveActionCommand extends Command {
  // clientTimeMs is the client's wall-clock (integer ms, survives the
  // serializer's toFixed(3)) when the input was generated. The server echoes
  // the latest one back via InputAcknowledgement so the client knows how much
  // of its input timeline is already baked into a snapshot and can replay the
  // rest for prediction. Defaults to 0 for inputs the server itself synthesises.
  public constructor(
    public readonly direction: vec2,
    public readonly clientTimeMs: number = 0,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.direction, this.clientTimeMs];
  }
}
