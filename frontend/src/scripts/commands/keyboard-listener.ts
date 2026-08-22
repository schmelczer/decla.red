import { vec2 } from 'gl-matrix';
import { CommandGenerator, LeapActionCommand, MoveActionCommand } from 'shared';
import { localCharacterPredictor } from '../helper/prediction/local-character-predictor';

export class KeyboardListener extends CommandGenerator {
  private keysDown: Set<string> = new Set();

  constructor() {
    super();

    addEventListener('keydown', this.keyDownListener);
    addEventListener('keyup', this.keyUpListener);
    addEventListener('blur', this.blurListener);
  }

  private keyDownListener = (event: KeyboardEvent) => {
    const key = event.code;
    if (
      (key === 'Space' || key === 'ShiftLeft' || key === 'ShiftRight') &&
      !this.keysDown.has(key)
    ) {
      const clientTimeMs = localCharacterPredictor.recordLeap();
      this.sendCommandToSubscribers(new LeapActionCommand(clientTimeMs));
    }

    if (this.keysDown.has(key)) {
      return;
    }
    this.keysDown.add(key);
    this.generateCommands();
  };

  private keyUpListener = (event: KeyboardEvent) => {
    if (this.keysDown.delete(event.code)) {
      this.generateCommands();
    }
  };

  private blurListener = () => {
    this.keysDown.clear();
    this.generateCommands();
  };

  private generateCommands() {
    const up = ~~(this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp'));
    const down = ~~(this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown'));
    const left = ~~(this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft'));
    const right = ~~(this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight'));

    const movement = vec2.fromValues(right - left, up - down);
    if (vec2.squaredLength(movement) > 0) {
      vec2.normalize(movement, movement);
    }

    const clientTimeMs = localCharacterPredictor.recordInput(movement);
    this.sendCommandToSubscribers(new MoveActionCommand(movement, clientTimeMs));
  }

  public destroy() {
    removeEventListener('keydown', this.keyDownListener);
    removeEventListener('keyup', this.keyUpListener);
    removeEventListener('blur', this.blurListener);
  }
}
