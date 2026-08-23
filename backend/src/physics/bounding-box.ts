import { vec2 } from 'gl-matrix';

export class BoundingBox {
  constructor(
    public xMin = 0,
    public xMax = 0,
    public yMin = 0,
    public yMax = 0,
  ) {}

  public static ofCircle(center: vec2, radius: number): BoundingBox {
    return new BoundingBox(
      center[0] - radius,
      center[0] + radius,
      center[1] - radius,
      center[1] + radius,
    );
  }

  public intersects(other: BoundingBox): boolean {
    return (
      this.xMin < other.xMax &&
      this.xMax > other.xMin &&
      this.yMin < other.yMax &&
      this.yMax > other.yMin
    );
  }
}
