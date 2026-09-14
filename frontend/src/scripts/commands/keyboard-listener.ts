import { vec2 } from 'gl-matrix';
import type { Command } from 'shared';
import { InputGenerator } from './input-generator';

const movementKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
]);
const leapKeys = new Set(['Space', 'ShiftLeft', 'ShiftRight']);

export class KeyboardListener extends InputGenerator {
  private keysDown: Set<string> = new Set();

  constructor(onCommand: (command: Command) => void) {
    super(onCommand);
    addEventListener('keydown', this.keyDownListener);
    addEventListener('keyup', this.keyUpListener);
    addEventListener('blur', this.blurListener);
  }

  private keyDownListener = (event: KeyboardEvent) => {
    const key = event.code;
    if (!movementKeys.has(key) && !leapKeys.has(key)) {
      return;
    }
    event.preventDefault();
    if (this.keysDown.has(key)) {
      return;
    }
    this.keysDown.add(key);
    if (leapKeys.has(key)) {
      this.sendLeap();
    } else {
      this.sendMovement();
    }
  };

  private keyUpListener = (event: KeyboardEvent) => {
    if (this.keysDown.delete(event.code) && movementKeys.has(event.code)) {
      this.sendMovement();
    }
  };

  private blurListener = () => {
    this.keysDown.clear();
    this.sendMovement();
  };

  public resendMovement() {
    if ([...this.keysDown].some((key) => movementKeys.has(key))) {
      this.sendMovement();
    }
  }

  private sendMovement() {
    const down = (...codes: Array<string>) =>
      codes.some((c) => this.keysDown.has(c)) ? 1 : 0;
    const movement = vec2.fromValues(
      down('KeyD', 'ArrowRight') - down('KeyA', 'ArrowLeft'),
      down('KeyW', 'ArrowUp') - down('KeyS', 'ArrowDown'),
    );
    this.sendMove(vec2.normalize(movement, movement));
  }

  public destroy() {
    removeEventListener('keydown', this.keyDownListener);
    removeEventListener('keyup', this.keyUpListener);
    removeEventListener('blur', this.blurListener);
  }
}
