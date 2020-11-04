import { vec2 } from 'gl-matrix';
import { CommandGenerator, MoveActionCommand } from 'shared';

export class KeyboardListener extends CommandGenerator {
  private keysDown: Set<string> = new Set();

  constructor() {
    super();

    addEventListener('keydown', this.keyDownListener);
    addEventListener('keyup', this.keyUpListener);
    addEventListener('blur', this.blurListener);
  }

  private keyDownListener = (event: KeyboardEvent) => {
    this.keysDown.add(event.key.toLowerCase());
    this.generateCommands();
  };

  private keyUpListener = (event: KeyboardEvent) => {
    this.keysDown.delete(event.key.toLowerCase());
    this.generateCommands();
  };

  private blurListener = () => {
    this.keysDown.clear();
    this.generateCommands();
  };

  private generateCommands() {
    const up = ~~(
      this.keysDown.has('w') ||
      this.keysDown.has('arrowup') ||
      this.keysDown.has(' ')
    );
    const down = ~~(this.keysDown.has('s') || this.keysDown.has('arrowdown'));
    const left = ~~(this.keysDown.has('a') || this.keysDown.has('arrowleft'));
    const right = ~~(this.keysDown.has('d') || this.keysDown.has('arrowright'));

    const movement = vec2.fromValues(right - left, up - down);
    if (vec2.squaredLength(movement) > 0) {
      vec2.normalize(movement, movement);
    }

    this.sendCommandToSubscribers(new MoveActionCommand(movement));
  }

  public destroy() {
    removeEventListener('keydown', this.keyDownListener);
    removeEventListener('keyup', this.keyUpListener);
    removeEventListener('blur', this.blurListener);
  }
}
