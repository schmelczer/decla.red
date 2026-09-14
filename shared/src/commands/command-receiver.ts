import { Command } from './command';

export type CommandExecutors = {
  [type: string]: (command: any) => unknown;
};

export abstract class CommandReceiver {
  protected commandExecutors: CommandExecutors = {};

  protected defaultCommandExecutor(_: Command) {}

  public handleCommand(command: Command) {
    const commandType = command.constructor.name;

    if (commandType in this.commandExecutors) {
      this.commandExecutors[commandType]!(command);
    } else {
      this.defaultCommandExecutor(command);
    }
  }
}
