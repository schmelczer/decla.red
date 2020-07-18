import { Line } from './line';

export class WorldMap {
  private lines: Array<Line> = [];

  constructor() {
    const delta = 0.01;
    for (let i = delta; i < 30; i += delta) {
      const linePoints = {
        a: { x: i - delta, y: Math.sin(i - delta) },
        b: { x: i, y: Math.sin(i) },
      };
      /*Vec2 tangent = lines[i].b - lines[i].a;
            lines[i].normal = vec2(-lines[i].normal.x * tangent.y, lines[i].normal.x * tangent.x);
            linePoints.normal = */
    }
  }
}
