import { vec2 } from 'gl-matrix';
import { BoundingBoxBase } from './bounding-box-base';
import { ImmutableBoundingBox } from './immutable-bounding-box';

export class BoundingBox extends BoundingBoxBase {
  public get topLeft(): vec2 {
    return vec2.fromValues(this._xMin, this._yMax);
  }

  public set topLeft(value: vec2) {
    this._xMin = value.x;
    this._yMax = value.y;
  }

  public get size(): vec2 {
    return vec2.fromValues(this._xMax - this._xMin, this._yMax - this._yMin);
  }

  public set size(value: vec2) {
    this._xMax = this.xMin + value.x;
    this._yMin = this.yMax - value.y;
  }

  public cloneAsImmutable(): ImmutableBoundingBox {
    return new ImmutableBoundingBox(
      this.shape,
      this.xMin,
      this.xMax,
      this.yMin,
      this.yMax
    );
  }
}
