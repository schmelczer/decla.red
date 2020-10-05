import { Command } from 'shared';

export class StepCommand extends Command {
  public static readonly type = 'StepCommand';

  public constructor(public readonly deltaTimeInMiliseconds: DOMHighResTimeStamp) {
    super();
  }
}
