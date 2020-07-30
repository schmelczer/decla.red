import { Command } from '../../commands/command';

export class StepCommand extends Command {
  public constructor(
    public readonly deltaTimeInMiliseconds?: DOMHighResTimeStamp
  ) {
    super();
  }

  public get type(): string {
    return 'StepCommand';
  }
}
