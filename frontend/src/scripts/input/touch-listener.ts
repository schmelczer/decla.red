import { vec2 } from 'gl-matrix';
import { CommandGenerator } from '../commands/command-generator';
import { PrimaryActionCommand } from './commands/primary-action';
import { SecondaryActionCommand } from './commands/secondary-action';
import { SwipeCommand } from './commands/swipe';

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
        new SwipeCommand(vec2.subtract(vec2.create(), position, this.previousPosition))
      );

      this.previousPosition = position;
    });
  }

  private positionFromEvent(event: TouchEvent): vec2 {
    return vec2.fromValues(event.touches[0].clientX, event.touches[0].clientY);
  }
}
