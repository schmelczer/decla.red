import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';
import { Vec2 } from '../../math/vec2';
import { last } from '../../helper/last';

export interface Line {
  from: Vec2;
  to: Vec2;
  normal: Vec2;
  isLineEnd: boolean;
}

export class Dungeon extends GameObject {
  private lines: Array<Line> = [];

  constructor() {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));

    let previousHeight = 0;
    let previousPoint = {
      from: new Vec2(),
      to: new Vec2(-10000, 0),
    };

    for (let i = 0; i < 5000; i += 50) {
      const height = previousHeight + (Math.random() - 0.5) * 200;
      previousHeight = height;
      const current = {
        from: previousPoint.to,
        to: new Vec2(i, height),
        normal: new Vec2(1.0),
        isLineEnd: false,
      };
      this.lines.push(current);
      previousPoint = current;
    }

    last(this.lines).to = last(this.lines).to.add(new Vec2(10000, 0));
    last(this.lines).isLineEnd = true;

    const delta = new Vec2(200, 400);
    this.lines = [
      ...this.lines,
      ...this.lines.map(({ from, to, normal, isLineEnd }) => ({
        normal: normal.scale(-1),
        from: from.add(delta),
        to: to.add(delta),
        isLineEnd,
      })),
    ];

    this.calculateNormals();
  }

  private calculateNormals() {
    this.lines.forEach((l) => {
      const tangent = l.to.subtract(l.from);
      l.normal = new Vec2(
        -l.normal.x * tangent.y,
        l.normal.x * tangent.x
      ).normalized;
    });
  }

  private draw(c: DrawCommand) {
    const linesToBeDrawn: Array<Line> = [];

    for (let line of this.lines) {
      if (c.drawer.isOnScreen(line.from) || c.drawer.isOnScreen(line.to)) {
        linesToBeDrawn.push(line);
      } else if (line.isLineEnd && last(linesToBeDrawn) != null) {
        last(linesToBeDrawn).isLineEnd = true;
      }
    }

    c.drawer.giveUniforms({ lines: linesToBeDrawn });
  }
}
