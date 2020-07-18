import { CommandGenerator } from '../commands/command-generator';
import { PrimaryActionCommand } from '../commands/types/primary-action';
import { SecondaryActionCommand } from '../commands/types/secondary-action';
import { Vec2 } from '../math/vec2';
import { SwipeCommand } from '../commands/types/swipe';

export class TouchListener extends CommandGenerator {
  private previousPosition: Vec2 = null;

  constructor(private target: Element = document.body) {
    super();

    target.addEventListener('touchstart', (event: TouchEvent) => {
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
      const position = this.positionFromEvent(event);

      this.sendCommand(
        new SwipeCommand(position.subtract(this.previousPosition))
      );

      this.previousPosition = position;
    });
  }

  private positionFromEvent(event: TouchEvent): Vec2 {
    return new Vec2(
      event.touches[0].clientX / this.target.clientWidth,
      -event.touches[0].clientY / this.target.clientHeight
    );
  }
}
