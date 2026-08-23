import { vec2 } from 'gl-matrix';
import { chargeHeldSince, Command } from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';
import { pointer } from '../helper/pointer';
import { InputGenerator } from './input-generator';

export class MouseListener extends InputGenerator {
  private primaryDownAt: number | null = null;

  constructor(
    private readonly target: HTMLElement,
    private readonly game: Game,
    onCommand: (command: Command) => void,
  ) {
    super(onCommand);
    target.addEventListener('mousedown', this.mouseDownListener);
    target.addEventListener('mousemove', this.mouseMoveListener);
    target.addEventListener('contextmenu', this.contextMenuListener);
    window.addEventListener('mouseup', this.mouseUpListener);
    window.addEventListener('blur', this.cancelPrimary);
  }

  private mouseMoveListener = (event: MouseEvent) => {
    pointer.displayPosition = vec2.fromValues(event.clientX, event.clientY);
  };

  private mouseDownListener = (event: MouseEvent) => {
    if (event.button === 0) {
      this.primaryDownAt = performance.now();
      ChargeIndicator.begin(event.clientX, event.clientY, true);
    }
  };

  private mouseUpListener = (event: MouseEvent) => {
    if (event.button !== 0 || this.primaryDownAt === null) {
      return;
    }
    ChargeIndicator.end();
    const charge = chargeHeldSince(this.primaryDownAt);
    this.primaryDownAt = null;
    this.sendPrimary(
      this.game.displayToWorldCoordinates(vec2.fromValues(event.clientX, event.clientY)),
      charge,
    );
  };

  private cancelPrimary = () => {
    this.primaryDownAt = null;
    ChargeIndicator.end();
  };

  private contextMenuListener = (event: MouseEvent) => {
    event.preventDefault();
  };

  public destroy() {
    ChargeIndicator.end();
    this.target.removeEventListener('mousedown', this.mouseDownListener);
    this.target.removeEventListener('mousemove', this.mouseMoveListener);
    this.target.removeEventListener('contextmenu', this.contextMenuListener);
    window.removeEventListener('mouseup', this.mouseUpListener);
    window.removeEventListener('blur', this.cancelPrimary);
  }
}
