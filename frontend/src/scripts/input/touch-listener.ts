import { CommandGenerator } from '../commands/command-generator';
import { PrimaryActionCommand } from '../commands/types/primary-action';
import { SecondaryActionCommand } from '../commands/types/secondary-action';
import { Vec2 } from '../math/vec2';
import { SwipeCommand } from '../commands/types/swipe';

export class TouchListener extends CommandGenerator {
  private previousPosition: Vec2 = null;

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
        new SwipeCommand(position.subtract(this.previousPosition))
      );

      this.previousPosition = position;
    });
  }

  private positionFromEvent(event: TouchEvent): Vec2 {
    const bb = this.target.getBoundingClientRect();

    return new Vec2(
      1 - (event.touches[0].clientX - bb.x) / bb.width,
      (event.touches[0].clientY - bb.y) / bb.height
    ).clamped_0_1;
  }
}
