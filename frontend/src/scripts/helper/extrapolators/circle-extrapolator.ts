import { Circle } from 'shared';
import { LinearExtrapolator } from './linear-extrapolator';
import { Vec2Extrapolator } from './vec2-extrapolator';

export class CircleExtrapolator {
  private center: Vec2Extrapolator;
  private radius: LinearExtrapolator;

  constructor(currentValue: Circle) {
    this.center = new Vec2Extrapolator(currentValue.center);
    this.radius = new LinearExtrapolator(currentValue.radius);
  }

  public addFrame(value: Circle, rateOfChange: Circle) {
    this.center.addFrame(value.center, rateOfChange.center);
    this.radius.addFrame(value.radius, rateOfChange.radius);
  }

  public getValue(deltaTime: number): Circle {
    return new Circle(this.center.getValue(deltaTime), this.radius.getValue(deltaTime));
  }
}
