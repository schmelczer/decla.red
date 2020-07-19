import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';
import { Vec2 } from '../../math/vec2';
import { MoveToCommand } from '../../commands/types/move-to';

export class Camera extends GameObject {
  constructor() {
    super();
    this._boundingBoxSize = new Vec2(1200, 800);

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  private draw(e: DrawCommand) {
    e.drawer.setCameraPosition(this.position);
    e.drawer.setViewBoxSize(this.boundingBoxSize);
  }

  private moveTo(e: MoveToCommand) {
    this._position = e.position;
  }
}
