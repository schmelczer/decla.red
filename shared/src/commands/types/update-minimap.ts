import { vec2 } from 'gl-matrix';
import { Id } from '../../communication/id';
import { CharacterTeam } from '../../objects/types/character-base';
import { serializable } from '../../serialization/serializable';
import { Command } from '../command';

@serializable
export class MinimapPlayer {
  public constructor(
    public readonly id: Id,
    public readonly position: vec2,
    public readonly team: CharacterTeam,
  ) {}

  public toArray(): Array<any> {
    return [this.id, this.position, this.team];
  }
}

@serializable
export class UpdateMinimap extends Command {
  public constructor(public readonly players: Array<MinimapPlayer>) {
    super();
  }

  public toArray(): Array<any> {
    return [this.players];
  }
}
