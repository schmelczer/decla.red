import { Typed } from '../transport/serializable';
import { IdentityManager } from '../identity/identity-manager';
import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { vec2 } from 'gl-matrix';

export abstract class GameObject extends Typed implements CommandReceiver {
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
    [commandName: string]: (e: Command) => void;
  } = {};

  protected addCommandExecutor<T extends Command>(
    commandType: new () => T,
    handler: (command: T) => void
  ) {
    this.commandExecutors[commandType.name] = handler;
  }

  public sendCommand(command: Command) {
    const commandType = command.constructor.name;

    if (this.commandExecutors.hasOwnProperty(commandType)) {
      this.commandExecutors[commandType](command);
    }
  }
}
