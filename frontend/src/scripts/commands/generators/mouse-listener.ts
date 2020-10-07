import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  PrimaryActionCommand,
  SecondaryActionCommand,
  TernaryActionCommand,
} from 'shared';

export class MouseListener extends CommandGenerator {
  constructor(target: HTMLElement) {
    super();

    target.addEventListener('mousemove', (event: MouseEvent) => {
      const position = this.positionFromEvent(event);
      this.sendCommandToSubcribers(new PrimaryActionCommand(position));
    });

    target.addEventListener('mousedown', (event: MouseEvent) => {
      const position = this.positionFromEvent(event);

      if (event.button == 0) {
        this.sendCommandToSubcribers(new SecondaryActionCommand(position));
      }
    });

    target.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      const position = this.positionFromEvent(event);
      this.sendCommandToSubcribers(new TernaryActionCommand(position));
    });
  }

  private positionFromEvent(event: MouseEvent): vec2 {
    return vec2.fromValues(event.clientX, event.clientY);
  }
}
