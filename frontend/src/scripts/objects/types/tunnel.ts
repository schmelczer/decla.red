import { vec2 } from 'gl-matrix';
import { DrawCommand } from '../../commands/types/draw';
import { GameObject } from '../game-object';

export interface Line {}

export class Tunnel extends GameObject {
  constructor(
    private from: vec2,
    private to: vec2,
    private radiusFrom: number,
    private radiusTo: number
  ) {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
  }

  private draw(c: DrawCommand) {
    if (c.drawer.isOnScreen(this.from) || c.drawer.isOnScreen(this.to)) {
      c.drawer.appendToUniformList('lines', this.from, this.to);
      c.drawer.appendToUniformList('radii', this.radiusFrom, this.radiusTo);
    }
  }
}
