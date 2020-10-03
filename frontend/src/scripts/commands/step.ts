import { Command } from './command';

export class StepCommand extends Command {
  public constructor(public readonly deltaTimeInMiliseconds?: DOMHighResTimeStamp) {
    super();
  }

  public get type(): string {
    return 'StepCommand';
  }
}
