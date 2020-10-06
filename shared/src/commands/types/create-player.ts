import { CharacterBase } from '../../objects/types/character-base';
import { serializable } from '../../transport/serializable/serializable';
import { Command } from '../command';

@serializable()
export class CreatePlayerCommand extends Command {
  public constructor(public readonly character: CharacterBase) {
    super();
  }

  public toArray(): Array<any> {
    return [this.character];
  }
}
