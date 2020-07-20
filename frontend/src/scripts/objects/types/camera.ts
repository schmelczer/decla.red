import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';
import { MoveToCommand } from '../../commands/types/move-to';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080;

  constructor() {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  private draw(c: DrawCommand) {
    c.drawer.setCameraPosition(this.position);
    this._boundingBoxSize = c.drawer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    this._position = c.position;
  }
}
