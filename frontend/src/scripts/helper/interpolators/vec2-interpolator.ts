import { vec2 } from 'gl-matrix';
import { LinearInterpolator } from './linear-interpolator';

export class Vec2Interpolator {
  private x: LinearInterpolator;
  private y: LinearInterpolator;

  constructor(currentValue: vec2) {
    this.x = new LinearInterpolator(currentValue[0]);
    this.y = new LinearInterpolator(currentValue[1]);
  }

  public addFrame(value: vec2, rateOfChange: vec2) {
    this.x.addFrame(value[0], rateOfChange[0]);
    this.y.addFrame(value[1], rateOfChange[1]);
  }

  public getValue(deltaTime: number): vec2 {
    return vec2.fromValues(this.x.getValue(deltaTime), this.y.getValue(deltaTime));
  }
}
