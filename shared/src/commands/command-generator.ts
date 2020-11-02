import { CommandReceiver } from './command-receiver';
import { Command } from './command';

export class CommandGenerator {
  private subscribers: Array<CommandReceiver> = [];

  public subscribe(subscriber: CommandReceiver): void {
    this.subscribers.push(subscriber);
  }

  protected sendCommandToSubscribers(command: Command): void {
    this.subscribers.forEach((s) => s.sendCommand(command));
  }
}
