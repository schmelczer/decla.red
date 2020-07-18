import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { ObjectContainer } from '../objects/object-container';
import { KeyDownCommand } from '../commands/types/key-down';
import { KeyUpCommand } from '../commands/types/key-up';
import { SwipeCommand } from '../commands/types/swipe';

export class GameLogic implements CommandReceiver {
  private commandBuffer: Array<Command> = [];
  private keysDown: Set<string> = new Set();

  constructor(private objects: ObjectContainer) {}

  public step(time: DOMHighResTimeStamp) {
    while (this.commandBuffer.length > 0) {
      const command = this.commandBuffer.pop();
      console.log(command);

      if (command instanceof KeyDownCommand) {
        this.keysDown.add(command.key);
      }

      if (command instanceof KeyUpCommand) {
        this.keysDown.delete(command.key);
      }

      if (command instanceof SwipeCommand) {
        this.objects.camera.position = this.objects.camera.position.subtract(
          command.delta.scale(200)
        );
      }
    }

    if (this.keysDown.has('w')) {
      this.objects.camera.position.y += 10;
    }

    if (this.keysDown.has('s')) {
      this.objects.camera.position.y -= 10;
    }

    if (this.keysDown.has('a')) {
      this.objects.camera.position.x -= 10;
    }

    if (this.keysDown.has('d')) {
      this.objects.camera.position.x += 10;
    }
  }

  public sendCommand(command: Command) {
    this.commandBuffer.push(command);
  }
}
