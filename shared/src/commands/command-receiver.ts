import { Command } from './command';

export type CommandExecutors = {
  [type: string]: (command: any) => unknown;
};

export abstract class CommandReceiver {
  protected commandExecutors: CommandExecutors = {};

  public reactsToCommand(commandType: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.commandExecutors, commandType);
  }

  protected defaultCommandExecutor(_: Command) {}

  public sendCommand(command: Command) {
    const commandType = command.type;

    if (Object.prototype.hasOwnProperty.call(this.commandExecutors, commandType)) {
      this.commandExecutors[commandType](command);
    } else {
      this.defaultCommandExecutor(command);
    }
  }
}
