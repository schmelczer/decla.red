import { PlayerCharacterBase } from '../../objects/types/player-character-base';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class CreatePlayerCommand extends Command {
  public constructor(public readonly character: PlayerCharacterBase) {
    super();
  }

  public toArray(): Array<any> {
    return [this.character];
  }
}
