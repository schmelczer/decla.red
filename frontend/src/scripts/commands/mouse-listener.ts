import { vec2 } from 'gl-matrix';
import { CommandGenerator, PrimaryActionCommand, SecondaryActionCommand } from 'shared';
import { Game } from '../game';

export class MouseListener extends CommandGenerator {
  constructor(private target: HTMLElement, private readonly game: Game) {
    super();

    target.addEventListener('mousedown', this.mouseDownListener);
    target.addEventListener('contextmenu', this.contextMenuListener);
  }

  private mouseDownListener = (event: MouseEvent) => {
    const position = this.positionFromEvent(event);

    if (event.button === 0) {
      this.sendCommandToSubscribers(new PrimaryActionCommand(position));
    }
  };

  private contextMenuListener = (event: MouseEvent) => {
    event.preventDefault();

    const position = this.positionFromEvent(event);
    this.sendCommandToSubscribers(new SecondaryActionCommand(position));
  };

  private positionFromEvent(event: MouseEvent): vec2 {
    return this.game.displayToWorldCoordinates(
      vec2.fromValues(event.clientX, event.clientY),
    );
  }

  public destroy() {
    this.target.removeEventListener('mousedown', this.mouseDownListener);
    this.target.removeEventListener('contextmenu', this.contextMenuListener);
  }
}
