import { vec2 } from 'gl-matrix';
import { CharacterTeam } from '../../objects/types/character-team';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { Command } from '../command';

@serializable
export class OtherPlayerDirection {
  public constructor(
    public readonly id: Id,
    public readonly direction: vec2,
    public readonly team: CharacterTeam,
  ) {}

  public toArray(): Array<any> {
    return [this.id, this.direction, this.team];
  }
}

@serializable
export class UpdateOtherPlayerDirections extends Command {
  public constructor(public readonly otherPlayerDirections: Array<OtherPlayerDirection>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.otherPlayerDirections];
  }
}
