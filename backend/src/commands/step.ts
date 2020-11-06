import { Command, CommandReceiver } from 'shared';

export class StepCommand extends Command {
  public constructor(
    public readonly deltaTimeInSeconds: number,
    public readonly game: CommandReceiver,
  ) {
    super();
  }
}
