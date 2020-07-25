import { vec2, vec3 } from 'gl-matrix';
import { DrawCommand } from '../../commands/types/draw';
import { GameObject } from '../game-object';

export class CircleLight extends GameObject {
  constructor(
    private center: vec2,
    private radius: number,
    private value: vec3
  ) {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
  }

  private draw(c: DrawCommand) {
    if (c.drawer.isOnScreen(this.center)) {
      c.drawer.appendToUniformList('lights', {
        center: this.center,
        radius: this.radius,
        value: this.value,
      });
    }
  }
}
