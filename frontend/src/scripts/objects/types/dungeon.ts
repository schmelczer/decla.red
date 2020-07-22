import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';
import { Vec2 } from '../../math/vec2';
import { last } from '../../helper/last';

export interface Line {
  start: Vec2;
  end: Vec2;
  radius: number;
}

export class Dungeon extends GameObject {
  private lines: Array<Line> = [];

  constructor() {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));

    let previousHeight = 0;
    let previousEnd = new Vec2();

    for (let i = 0; i < 5000; i += 50) {
      const height = previousHeight + (Math.random() - 0.5) * 200;
      previousHeight = height;
      const currentEnd = new Vec2(i, height);

      this.lines.push({
        start: previousEnd,
        end: currentEnd,
        radius: Math.random() * 15 + 15,
      });

      previousEnd = currentEnd;
    }
  }

  private draw(c: DrawCommand) {
    const lines: Array<Vec2> = [];
    const radii: Array<number> = [];

    for (let line of this.lines) {
      if (c.drawer.isOnScreen(line.start) || c.drawer.isOnScreen(line.end)) {
        lines.push(line.start);
        lines.push(line.end);
        radii.push(line.radius);
      }
    }

    c.drawer.giveUniforms({ lines, radii });
  }
}
