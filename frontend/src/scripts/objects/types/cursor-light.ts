import { vec2, vec3 } from 'gl-matrix';
import { CursorMoveCommand } from '../../commands/types/cursor-move-command';
import { DrawCommand } from '../../commands/types/draw';
import { GameObject } from '../game-object';

export class CursorLight extends GameObject {
  private mousePosition = vec2.create();

  constructor(private radius: number, private value: vec3) {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
    this.addCommandExecutor(CursorMoveCommand, this.setPosition.bind(this));
  }

  private draw(c: DrawCommand) {
    const center = c.drawer.screenUvToWorldCoordinate(this.mousePosition);
    if (c.drawer.isOnScreen(center)) {
      c.drawer.appendToUniformList('lights', {
        center,
        radius: this.radius,
        value: this.value,
      });
    }
  }

  private setPosition(c: CursorMoveCommand) {
    this.mousePosition = c.position;
  }
}
