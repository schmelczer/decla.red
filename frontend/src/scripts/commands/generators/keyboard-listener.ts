import { vec2 } from 'gl-matrix';
import { CommandGenerator, MoveActionCommand } from 'shared';

export class KeyboardListener extends CommandGenerator {
  private keysDown: Set<string> = new Set();

  constructor(target: HTMLElement) {
    super();

    target.addEventListener('keydown', (event: KeyboardEvent) => {
      const key = this.normalize(event.key);
      this.keysDown.add(key);
      this.generateCommands();
    });

    target.addEventListener('keyup', (event: KeyboardEvent) => {
      const key = this.normalize(event.key);
      this.keysDown.delete(key);
      this.generateCommands();
    });
  }

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
    this.sendCommandToSubcribers(new MoveActionCommand(movement));
  }

  private normalize(key: string): string {
    return key.toLowerCase();
  }
}
