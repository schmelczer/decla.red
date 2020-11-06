import { Command, GameObject } from 'shared';

export class ReactToCollisionCommand extends Command {
  public constructor(public readonly other: GameObject) {
    super();
  }
}
