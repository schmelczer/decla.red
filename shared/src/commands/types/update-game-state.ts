import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class UpdateGameState extends Command {
  public constructor(
    public readonly declaCount: number,
    public readonly redCount: number,
    public readonly limit: number,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.declaCount, this.redCount, this.limit];
  }
}
