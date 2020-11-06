import { CommandReceiver } from './command-receiver';
import { Command } from './command';

export abstract class CommandGenerator {
  private subscribers: Array<CommandReceiver> = [];

  public subscribe(subscriber: CommandReceiver): void {
    this.subscribers.push(subscriber);
  }

  public clearSubscribers(): void {
    this.subscribers = [];
  }

  protected sendCommandToSubscribers(command: Command): void {
    this.subscribers.forEach((s) => s.handleCommand(command));
  }
}
