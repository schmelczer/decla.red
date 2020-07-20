import { CommandGenerator } from '../commands/command-generator';
import { PrimaryActionCommand } from '../commands/types/primary-action';
import { SecondaryActionCommand } from '../commands/types/secondary-action';
import { Vec2 } from '../math/vec2';
import { SwipeCommand } from '../commands/types/swipe';
import { ZoomCommand } from '../commands/types/zoom';

export class MouseListener extends CommandGenerator {
  private previousPosition: Vec2 = null;
  private isMouseDown = false;

  constructor(private target: Element) {
    super();

    target.addEventListener('mousedown', (event: MouseEvent) => {
      const position = this.positionFromEvent(event);

      this.previousPosition = position;
      this.isMouseDown = true;

      if (event.button == 0) {
        this.sendCommand(new PrimaryActionCommand(position));
      }
    });

    target.addEventListener('mousemove', (event: MouseEvent) => {
      if (this.isMouseDown) {
        const position = this.positionFromEvent(event);
        this.sendCommand(
          new SwipeCommand(this.previousPosition.subtract(position))
        );
        this.previousPosition = position;
      }
    });

    target.addEventListener('mouseup', (event: MouseEvent) => {
      this.isMouseDown = false;
    });

    target.addEventListener('mouseleave', (event: MouseEvent) => {
      this.isMouseDown = false;
    });

    target.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      const position = this.positionFromEvent(event);
      this.sendCommand(new SecondaryActionCommand(position));
    });

    target.addEventListener('wheel', (event: MouseWheelEvent) => {
      this.sendCommand(new ZoomCommand(event.deltaY > 0 ? 1.3 : 1 / 1.3));
    });
  }

  private positionFromEvent(event: MouseEvent): Vec2 {
    const bb = this.target.getBoundingClientRect();

    return new Vec2(
      (event.clientX - bb.x) / bb.width,
      1 - (event.clientY - bb.y) / bb.height
    ).clamped_0_1;
  }
}
