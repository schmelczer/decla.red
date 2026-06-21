import { vec2 } from 'gl-matrix';
import { CommandGenerator, PrimaryActionCommand, holdDurationToCharge } from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';
import { Pointer } from '../helper/pointer';

export class MouseListener extends CommandGenerator {
  // Timestamp (ms) of the primary press, or null when not held. On release the
  // held duration is mapped to the charge scalar; a quick tap reads as ~0.
  private primaryDownAt: number | null = null;

  constructor(
    private target: HTMLElement,
    private readonly game: Game,
  ) {
    super();

    target.addEventListener('mousedown', this.mouseDownListener);
    target.addEventListener('mouseup', this.mouseUpListener);
    target.addEventListener('mousemove', this.mouseMoveListener);
    target.addEventListener('contextmenu', this.contextMenuListener);
  }

  // Only the screen position is stored; it is reprojected to world space each
  // frame so the gaze stays correct even while the camera pans under a still
  // cursor.
  private mouseMoveListener = (event: MouseEvent) => {
    Pointer.setDisplayPosition(event.clientX, event.clientY);
  };

  private mouseDownListener = (event: MouseEvent) => {
    if (event.button === 0) {
      this.primaryDownAt = performance.now();
      // The ring follows the cursor and only fades in once this press has
      // clearly become a hold.
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
      new PrimaryActionCommand(this.positionFromEvent(event), charge),
    );
  };

  // Suppress the browser context menu on the canvas; right-click has no action.
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
    this.target.removeEventListener('mouseup', this.mouseUpListener);
    this.target.removeEventListener('mousemove', this.mouseMoveListener);
    this.target.removeEventListener('contextmenu', this.contextMenuListener);
  }
}
