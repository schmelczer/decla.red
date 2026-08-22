import { vec2 } from 'gl-matrix';

interface InputSample {
  timeMs: number;
  direction: vec2;
}

const retainMs = 1500;

// Timeline of local movement directions; the predictor replays exactly the input the server receives.
export class InputHistory {
  private samples: Array<InputSample> = [];

  public record(direction: vec2, timeMs: number): void {
    this.samples.push({ timeMs, direction: vec2.clone(direction) });

    const cutoff = timeMs - retainMs;
    while (this.samples.length > 1 && this.samples[1].timeMs <= cutoff) {
      this.samples.shift();
    }
  }

  public directionAt(timeMs: number): vec2 {
    let direction = vec2.create();
    for (const sample of this.samples) {
      if (sample.timeMs <= timeMs) {
        direction = sample.direction;
      } else {
        break;
      }
    }
    return vec2.clone(direction);
  }

  public reset(): void {
    this.samples = [];
  }
}
