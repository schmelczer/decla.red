import { CommandGenerator } from '../commands/command-generator';
import { KeyDownCommand } from './commands/key-down';
import { KeyUpCommand } from './commands/key-up';

export class KeyboardListener extends CommandGenerator {
  constructor(target: Element) {
    super();

    target.addEventListener('keydown', (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.sendCommand(new KeyDownCommand(key));
    });

    target.addEventListener('keyup', (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.sendCommand(new KeyUpCommand(key));
    });
  }
}
