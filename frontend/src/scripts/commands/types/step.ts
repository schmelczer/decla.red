import { Command } from 'shared';

export class StepCommand extends Command {
  public constructor(public readonly deltaTimeInSeconds: number) {
    super();
  }
}
