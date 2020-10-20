import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class UpdatePlanetOwnershipCommand extends Command {
  public constructor(
    public readonly declaCount: number,
    public readonly redCount: number,
    public readonly neutralCount: number,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.declaCount, this.redCount, this.neutralCount];
  }
}
