import { Command } from '../command';

export class StepCommand extends Command {
  public static readonly type = 'StepCommand';

  public constructor(public readonly deltaTimeInMiliseconds: DOMHighResTimeStamp) {
    super();
  }
}
