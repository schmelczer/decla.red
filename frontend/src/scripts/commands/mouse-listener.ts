import { vec2 } from 'gl-matrix';
import { CommandGenerator, PrimaryActionCommand, holdDurationToCharge } from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';
import { predictorNowMs } from '../helper/prediction/local-character-predictor';
import { pointer } from '../helper/pointer';

export class MouseListener extends CommandGenerator {
  private primaryDownAt: number | null = null;

  constructor(
    private target: HTMLElement,
    private readonly game: Game,
  ) {
    super();

    target.addEventListener('mousedown', this.mouseDownListener);
    target.addEventListener('mousemove', this.mouseMoveListener);
    target.addEventListener('contextmenu', this.contextMenuListener);
    // Release watched on the window, not the canvas — a release over UI or outside the window must still fire.
    window.addEventListener('mouseup', this.mouseUpListener);
    window.addEventListener('blur', this.cancelPrimary);
  }

  // Store screen position; reproject to world each frame so gaze stays correct while the camera pans.
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
    const charge = holdDurationToCharge((performance.now() - this.primaryDownAt) / 1000);
    this.primaryDownAt = null;
    this.sendCommandToSubscribers(
      new PrimaryActionCommand(
        this.positionFromEvent(event),
        charge,
        Math.round(predictorNowMs()),
      ),
    );
  };

  private cancelPrimary = () => {
    if (this.primaryDownAt !== null) {
      this.primaryDownAt = null;
      ChargeIndicator.end();
    }
  };

  private contextMenuListener = (event: MouseEvent) => {
    event.preventDefault();
  };

  private positionFromEvent(event: MouseEvent): vec2 {
    return this.game.displayToWorldCoordinates(
      vec2.fromValues(event.clientX, event.clientY),
    );
  }

  public destroy() {
    ChargeIndicator.end();
    this.target.removeEventListener('mousedown', this.mouseDownListener);
    this.target.removeEventListener('mousemove', this.mouseMoveListener);
    this.target.removeEventListener('contextmenu', this.contextMenuListener);
    window.removeEventListener('mouseup', this.mouseUpListener);
    window.removeEventListener('blur', this.cancelPrimary);
  }
}
