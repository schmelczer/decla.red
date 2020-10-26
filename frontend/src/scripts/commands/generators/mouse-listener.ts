import { vec2 } from 'gl-matrix';
import { CommandGenerator, SecondaryActionCommand, TernaryActionCommand } from 'shared';
import { Game } from '../../game';

export class MouseListener extends CommandGenerator {
  constructor(target: HTMLElement, private readonly game: Game) {
    super();

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
    return this.game.displayToWorldCoordinates(
      vec2.fromValues(event.clientX, event.clientY),
    );
  }
}
