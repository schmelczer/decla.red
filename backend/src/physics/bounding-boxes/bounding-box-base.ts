import { vec2 } from 'gl-matrix';

// axis-aligned
export abstract class BoundingBoxBase {
  constructor(
    protected _xMin: number = 0,
    protected _xMax: number = 0,
    protected _yMin: number = 0,
    protected _yMax: number = 0,
  ) {}

  [key: number]: number | undefined;

  public get 0(): number {
    return this._xMin;
  }

  public get 1(): number {
    return this._xMax;
  }

  public get 2(): number {
    return this._yMin;
  }

  public get 3(): number {
    return this._yMax;
  }

  public get xMin(): number {
    return this._xMin;
  }

  public get xMax(): number {
    return this._xMax;
  }

  public get yMin(): number {
    return this._yMin;
  }

  public get yMax(): number {
    return this._yMax;
  }

  public get topLeft(): vec2 {
    return vec2.fromValues(this._xMin, this._yMax);
  }

  public get size(): vec2 {
    return vec2.fromValues(this._xMax - this._xMin, this._yMax - this._yMin);
  }

  public intersects(other: BoundingBoxBase): boolean {
    return (
      this._xMin < other._xMax &&
      this._xMax > other._xMin &&
      this._yMin < other._yMax &&
      this._yMax > other._yMin
    );
  }
}
