import { CommandExecutors } from './command-executors';
import { Command } from './command';

export abstract class CommandReceiver {
  protected commandExecutors: CommandExecutors = {};

  protected defaultCommandExecutor(_: Command) {}

  public handleCommand(command: Command) {
    const commandType = command.type;

    if (Object.prototype.hasOwnProperty.call(this.commandExecutors, commandType)) {
      this.commandExecutors[commandType]!(command);
    } else {
      this.defaultCommandExecutor(command);
    }
  }
}
