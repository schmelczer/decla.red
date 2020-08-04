import { vec2 } from 'gl-matrix';
import { BoundingBoxBase } from './bounding-box-base';
import { IPrimitive } from '../../drawing/drawables/primitives/i-primitive';

export class BoundingBox extends BoundingBoxBase {
  constructor(
    value: IPrimitive,
    xMin: number = 0,
    xMax: number = 0,
    yMin: number = 0,
    yMax: number = 0
  ) {
    super(value, xMin, xMax, yMin, yMax);
  }

  public get topLeft(): vec2 {
    return vec2.fromValues(this._xMin, this._yMax);
  }

  public get size(): vec2 {
    return vec2.fromValues(this._xMax - this._xMin, this._yMax - this._yMin);
  }
  public set topLeft(value: vec2) {
    this._xMin = value.x;
    this._yMax = value.y;
  }

  public set size(value: vec2) {
    this._xMax = this.xMin + value.x;
    this._yMin = this.yMax - value.y;
  }
}
