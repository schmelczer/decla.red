import { Circle } from 'shared';
import { LinearInterpolator } from './linear-interpolator';
import { Vec2Interpolator } from './vec2-interpolator';

export class CircleInterpolator {
  private center: Vec2Interpolator;
  private radius: LinearInterpolator;

  constructor(currentValue: Circle) {
    this.center = new Vec2Interpolator(currentValue.center);
    this.radius = new LinearInterpolator(currentValue.radius);
  }

  public addFrame(value: Circle, rateOfChange: Circle) {
    this.center.addFrame(value.center, rateOfChange.center);
    this.radius.addFrame(value.radius, rateOfChange.radius);
  }

  public getValue(deltaTime: number): Circle {
    return new Circle(this.center.getValue(deltaTime), this.radius.getValue(deltaTime));
  }
}
