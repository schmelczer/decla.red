import { mix } from './mix';
import { clamp } from './clamp';

export class Autoscaler {
  // can have fractions
  private index: number;

  constructor(
    private setters: Array<(value: number) => void>,
    private targets: Array<Array<number>>,
    startingIndex: number,
    private scalingOptions: {
      additiveIncrease: number;
      multiplicativeDecrease: number;
    }
  ) {
    this.index = startingIndex;
    this.applyScaling();
  }

  public increase() {
    this.index += this.scalingOptions.additiveIncrease;
    this.applyScaling();
  }

  public decrease() {
    this.index /= this.scalingOptions.multiplicativeDecrease;
    this.applyScaling();
  }

  private applyScaling() {
    this.index = clamp(this.index, 0, this.targets.length - 1);

    const floor = Math.floor(this.index);
    const fract = this.index - floor;

    const previousTarget = this.targets[floor];
    const nextTarget =
      floor + 1 == this.targets.length
        ? previousTarget
        : this.targets[floor + 1];

    this.setters.forEach((setter, i) =>
      setter(mix(previousTarget[i], nextTarget[i], fract))
    );
  }
}
