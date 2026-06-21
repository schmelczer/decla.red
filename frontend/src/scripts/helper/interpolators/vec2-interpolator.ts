import { vec2 } from 'gl-matrix';
import { LinearInterpolator } from './linear-interpolator';

export class Vec2Interpolator {
  private x: LinearInterpolator;
  private y: LinearInterpolator;

  constructor(currentValue: vec2) {
    this.x = new LinearInterpolator(currentValue.x);
    this.y = new LinearInterpolator(currentValue.y);
  }

  public addFrame(value: vec2, rateOfChange: vec2) {
    this.x.addFrame(value.x, rateOfChange.x);
    this.y.addFrame(value.y, rateOfChange.y);
  }

  public getValue(deltaTime: number): vec2 {
    return vec2.fromValues(this.x.getValue(deltaTime), this.y.getValue(deltaTime));
  }
}
