import { vec2 } from 'gl-matrix';
import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { IdentityManager } from '../identity/identity-manager';

export abstract class GameObject implements CommandReceiver {
  public readonly id = IdentityManager.generateId();

  protected _position = vec2.create();
  public get position(): vec2 {
    return this._position;
  }

  protected _boundingBoxSize = vec2.create();
  public get boundingBoxSize(): vec2 {
    return this._boundingBoxSize;
  }

  private commandExecutors: {
    [commandType: string]: (e: Command) => void;
  } = {};

  // can only be called inside the constructor
  protected addCommandExecutor<T extends Command>(
    commandType: new () => T,
    handler: (command: T) => void
  ) {
    this.commandExecutors[new commandType().type] = handler;
  }

  public reactsToCommand(commandType: string): boolean {
    return this.commandExecutors.hasOwnProperty(commandType);
  }

  public sendCommand(command: Command) {
    const commandType = command.type;

    if (this.commandExecutors.hasOwnProperty(commandType)) {
      this.commandExecutors[commandType](command);
    }
  }
}
