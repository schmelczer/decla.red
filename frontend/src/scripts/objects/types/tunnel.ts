import { vec2 } from 'gl-matrix';
import { DrawCommand } from '../../commands/types/draw';
import { Circle } from '../../math/circle';
import { GameObject } from '../game-object';

export interface Line {}

export class Tunnel extends GameObject {
  private boundingCircle: Circle;
  private tangent: vec2;

  constructor(
    private from: vec2,
    private to: vec2,
    private radiusFrom: number,
    private radiusTo: number
  ) {
    super();

    this.boundingCircle = new Circle(
      vec2.fromValues(from.x / 2 + to.x / 2, from.y / 2 + to.y / 2),
      radiusFrom + radiusTo + vec2.distance(from, to)
    );

    this.tangent = vec2.subtract(vec2.create(), to, from);

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
  }

  private draw(c: DrawCommand) {
    if (c.drawer.isOnScreen(this.boundingCircle)) {
      c.drawer.appendToUniformList('lines', this.from, this.tangent);
      c.drawer.appendToUniformList('radii', this.radiusFrom, this.radiusTo);
    }
  }
}
