import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { IdentityManager } from '../identity/identity-manager';
import { Objects } from './objects';
import { Physics } from '../physics/physics';

export abstract class GameObject implements CommandReceiver {
  public readonly id = IdentityManager.generateId();

  private commandExecutors: {
    [commandType: string]: (e: Command) => void;
  } = {};

  public reactsToCommand(commandType: string): boolean {
    return this.commandExecutors.hasOwnProperty(commandType);
  }

  public sendCommand(command: Command) {
    const commandType = command.type;

    if (this.commandExecutors.hasOwnProperty(commandType)) {
      this.commandExecutors[commandType](command);
    }
  }

  // can only be called inside the constructor
  protected addCommandExecutor<T extends Command>(
    commandType: new () => T,
    handler: (command: T) => void
  ) {
    this.commandExecutors[new commandType().type] = handler;
  }
}
