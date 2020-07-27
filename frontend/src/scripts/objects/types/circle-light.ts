import { vec2, vec3 } from 'gl-matrix';
import { RenderCommand } from '../../commands/types/draw';
import { MoveToCommand } from '../../commands/types/move-to';
import { Circle } from '../../drawing/primitives/circle';
import { GameObject } from '../game-object';

const range = 2000;

export class CircleLight extends GameObject {
  private boundingCircle: Circle;

  constructor(
    private center: vec2,
    private radius: number,
    private value: vec3
  ) {
    super();

    this.boundingCircle = new Circle(center, range);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  private draw(c: RenderCommand) {
    if (c.renderer.isPositionOnScreen(this.center)) {
      c.renderer.appendToUniformList('lights', {
        center: this.center,
        radius: this.radius,
        value: this.value,
      });
    }
  }

  private moveTo(c: MoveToCommand) {
    this.center = c.position;
    this.boundingCircle.center = c.position;
  }
}
