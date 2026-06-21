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
    const key = event.key.toLowerCase();
    // Space leaps (W / ArrowUp already cover walking up). Edge-triggered so a
    // held key's auto-repeat doesn't spam leaps.
    if ((key === ' ' || key === 'shift') && !this.keysDown.has(key)) {
      const clientTimeMs = localCharacterPredictor.recordLeap();
      this.sendCommandToSubscribers(new LeapActionCommand(clientTimeMs));
    }
    this.keysDown.add(key);
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
    const up = ~~(this.keysDown.has('w') || this.keysDown.has('arrowup'));
    const down = ~~(this.keysDown.has('s') || this.keysDown.has('arrowdown'));
    const left = ~~(this.keysDown.has('a') || this.keysDown.has('arrowleft'));
    const right = ~~(this.keysDown.has('d') || this.keysDown.has('arrowright'));

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
