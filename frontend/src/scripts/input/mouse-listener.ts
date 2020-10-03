import { vec2 } from 'gl-matrix';
import { CommandGenerator } from '../commands/command-generator';
import { CursorMoveCommand } from './commands/cursor-move-command';
import { PrimaryActionCommand } from './commands/primary-action';
import { SecondaryActionCommand } from './commands/secondary-action';
import { SwipeCommand } from './commands/swipe';
import { ZoomCommand } from './commands/zoom';

export class MouseListener extends CommandGenerator {
  private previousPosition = vec2.create();

  private isMouseDown = false;

  constructor(target: Element) {
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
      const position = this.positionFromEvent(event);

      if (this.isMouseDown) {
        this.sendCommand(
          new SwipeCommand(vec2.subtract(vec2.create(), this.previousPosition, position))
        );
        this.previousPosition = position;
      }

      this.sendCommand(new CursorMoveCommand(position));
    });

    target.addEventListener('mouseup', (_: MouseEvent) => {
      this.isMouseDown = false;
    });

    target.addEventListener('mouseleave', (_: MouseEvent) => {
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

  private positionFromEvent(event: MouseEvent): vec2 {
    return vec2.fromValues(event.clientX, event.clientY);
  }
}
