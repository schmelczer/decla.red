import { Typed } from '../transport/serializable';
import { Vec2 } from '../math/vec2';
import { IdentityManager } from '../identity/identity-manager';
import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';

export abstract class GameObject extends Typed implements CommandReceiver {
  public readonly id = IdentityManager.generateId();

  protected _position = new Vec2();
  public get position(): Vec2 {
    return this._position;
  }

  protected _boundingBoxSize = new Vec2();
  public get boundingBoxSize(): Vec2 {
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
