import { Command } from './command';

export type CommandExecutors = {
  [type: string]: (command: Command) => void;
};

export abstract class CommandReceiver {
  protected commandExecutors: CommandExecutors = {};

  protected defaultCommandExecutor(command: Command) { }

  public reactsToCommand(commandType: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.commandExecutors, commandType);
  }

  public sendCommand(command: Command) {
    const commandType = command.type;

    if (Object.prototype.hasOwnProperty.call(this.commandExecutors, commandType)) {
      this.commandExecutors[commandType](command);
    } else {
      this.defaultCommandExecutor(command);
    }
  }
}
