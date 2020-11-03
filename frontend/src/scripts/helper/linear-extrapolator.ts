import { clamp } from 'shared';

export class LinearExtrapolator {
  private velocity = 0;
  private compensationVelocity = 0;
  private timeSinceSet = 0;

  constructor(private currentValue: number) {}

  public addFrame(value: number, rateOfChange: number) {
    this.timeSinceSet = 0;
    const differenceFromCurrent = value - this.currentValue;

    if (Math.abs(differenceFromCurrent) > 200) {
      this.currentValue = value;
      this.compensationVelocity = 0;
    } else {
      this.compensationVelocity = differenceFromCurrent / (1 / 30);
    }

    this.velocity = rateOfChange;
  }

  public getValue(deltaTime: number): number {
    this.currentValue += deltaTime * this.velocity;

    const compensationTimeLeft = 1 / 30 - this.timeSinceSet;

    if (compensationTimeLeft > 0) {
      this.currentValue +=
        Math.min(compensationTimeLeft, deltaTime) * this.compensationVelocity;
    }

    this.timeSinceSet += deltaTime;

    return this.currentValue;
  }
}
