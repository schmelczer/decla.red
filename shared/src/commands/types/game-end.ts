import { CharacterTeam } from '../../objects/types/character-team';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class GameEndCommand extends Command {
  constructor(
    public readonly winningTeam: CharacterTeam,
    public readonly endCardLengthInSeconds: number,
    public readonly shouldReconnect: boolean,
  ) {
    super();
  }

  public toArray(): Array<any> {
    return [this.winningTeam, this.endCardLengthInSeconds, this.shouldReconnect];
  }
}
