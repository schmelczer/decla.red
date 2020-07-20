import { GameObject } from '../game-object';
import { MoveToCommand } from '../../commands/types/move-to';
import { ZoomCommand } from '../../commands/types/zoom';
import { BeforeDrawCommand } from '../../commands/types/before-draw';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080;

  constructor() {
    super();

    this.addCommandExecutor(BeforeDrawCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
    this.addCommandExecutor(ZoomCommand, this.zoom.bind(this));
  }

  private draw(c: BeforeDrawCommand) {
    c.drawer.setCameraPosition(this.position);
    this._boundingBoxSize = c.drawer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    this._position = c.position;
  }

  private zoom(c: ZoomCommand) {
    this.inViewArea *= c.factor;
  }
}
