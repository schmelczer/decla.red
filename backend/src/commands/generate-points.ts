import { Command, GameObject } from 'shared';

export class GeneratePointsCommand extends Command {
  public constructor(public readonly decla: number, public readonly red: number) {
    super();
  }
}
