import { Typed } from '../transport/serializable';

export class Vec2 extends Typed {
  public constructor(public x: number = 0.0, public y: number = null) {
    super();

    if (this.y === null) {
      this.y = this.x;
    }
  }

  public scale(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  public add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  public subtract(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  public get list(): [number, number] {
    return [this.x, this.y];
  }
}
