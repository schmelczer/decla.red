import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';
import { vec2 } from 'gl-matrix';

export interface Line {
  start: vec2;
  end: vec2;
  radiusFrom: number;
  radiusTo: number;
}

export class Dungeon extends GameObject {
  private lines: Array<Line> = [];

  constructor() {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));

    let previousRadius = 0;
    let previousEnd = vec2.create();

    for (let i = 0; i < 500000; i += 500) {
      const height = previousEnd.y + (Math.random() - 0.5) * 2000;
      const currentEnd = vec2.fromValues(i, height);
      const currentToRadius = Math.random() * 10 + 300;

      this.lines.push({
        start: previousEnd,
        end: currentEnd,
        radiusFrom: previousRadius,
        radiusTo: currentToRadius,
      });

      previousEnd = currentEnd;
      previousRadius = currentToRadius;
    }
  }

  private draw(c: DrawCommand) {
    const lines: Array<vec2> = [];
    const radii: Array<number> = [];

    for (let line of this.lines) {
      if (c.drawer.isOnScreen(line.start) || c.drawer.isOnScreen(line.end)) {
        lines.push(line.start);
        lines.push(line.end);
        radii.push(line.radiusFrom);
        radii.push(line.radiusTo);
      }
    }

    c.drawer.giveUniforms({ lines, radii });
  }
}
