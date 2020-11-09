import { vec2 } from 'gl-matrix';
import { LinearExtrapolator } from './linear-extrapolator';

export class Vec2Extrapolator {
  private x: LinearExtrapolator;
  private y: LinearExtrapolator;

  constructor(currentValue: vec2) {
    this.x = new LinearExtrapolator(currentValue.x);
    this.y = new LinearExtrapolator(currentValue.y);
  }

  public addFrame(value: vec2, rateOfChange: vec2) {
    this.x.addFrame(value.x, rateOfChange.x);
    this.y.addFrame(value.y, rateOfChange.y);
  }

  public getValue(deltaTime: number): vec2 {
    return vec2.fromValues(this.x.getValue(deltaTime), this.y.getValue(deltaTime));
  }
}
