import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class UpdateGameState extends Command {
  public constructor(
    public readonly blueCount: number,
    public readonly redCount: number,
    public readonly limit: number,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.blueCount, this.redCount, this.limit];
  }
}
