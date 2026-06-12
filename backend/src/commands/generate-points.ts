import { Command } from 'shared';

export class GeneratePointsCommand extends Command {
  public constructor(
    public readonly blue: number,
    public readonly red: number,
  ) {
    super();
  }
}
