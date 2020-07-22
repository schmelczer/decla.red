import { CommandGenerator } from '../commands/command-generator';
import { PrimaryActionCommand } from '../commands/types/primary-action';
import { SecondaryActionCommand } from '../commands/types/secondary-action';
import { SwipeCommand } from '../commands/types/swipe';
import { vec2 } from 'gl-matrix';
import { clamp01 } from '../helper/clamp';

export class TouchListener extends CommandGenerator {
  private previousPosition = vec2.create();

  constructor(private target: HTMLElement) {
    super();

    target.addEventListener('touchstart', (event: TouchEvent) => {
      event.preventDefault();

      const touchCount = event.touches.length;
      const position = this.positionFromEvent(event);
      this.previousPosition = position;

      if (touchCount == 1) {
        this.sendCommand(new PrimaryActionCommand(position));
      } else {
        this.sendCommand(new SecondaryActionCommand(position));
      }
    });

    target.addEventListener('touchmove', (event: TouchEvent) => {
      event.preventDefault();

      const position = this.positionFromEvent(event);

      this.sendCommand(
        new SwipeCommand(
          vec2.subtract(vec2.create(), position, this.previousPosition)
        )
      );

      this.previousPosition = position;
    });
  }

  private positionFromEvent(event: TouchEvent): vec2 {
    const bb = this.target.getBoundingClientRect();

    return vec2.fromValues(
      clamp01(1 - (event.touches[0].clientX - bb.x) / bb.width),
      clamp01((event.touches[0].clientY - bb.y) / bb.height)
    );
  }
}
