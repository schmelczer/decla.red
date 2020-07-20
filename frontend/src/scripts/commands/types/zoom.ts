import { Command } from '../command';

export class ZoomCommand extends Command {
  public constructor(public readonly factor?: number) {
    super();
  }
}
