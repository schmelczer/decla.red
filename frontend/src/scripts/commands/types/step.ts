import { Command } from '../command';

export class StepCommand extends Command {
  public constructor(
    public readonly deltaTimeInMiliseconds?: DOMHighResTimeStamp
  ) {
    super();
  }
}
