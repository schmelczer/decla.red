import { vec2 } from 'gl-matrix';

interface InputSample {
  timeMs: number;
  direction: vec2;
}

// Keep a little over a second of input — far more than any sane reconciliation
// window — so a brief stall (or a backgrounded tab catching up) can still be
// replayed, while old samples are pruned to bound memory.
const retainMs = 1500;

// A timeline of the local player's movement directions in client-clock time.
// Each generated MoveActionCommand is stamped with the time this hands out, and
// the same sample is recorded here so the predictor replays exactly the input
// the server will eventually receive. Direction is piecewise-constant: the
// active direction at any instant is the most recent sample at or before it.
export class InputHistory {
  private samples: Array<InputSample> = [];

  public record(direction: vec2, timeMs: number): void {
    this.samples.push({ timeMs, direction: vec2.clone(direction) });

    const cutoff = timeMs - retainMs;
    while (this.samples.length > 1 && this.samples[1].timeMs <= cutoff) {
      this.samples.shift();
    }
  }

  // The held direction at `timeMs`: the latest sample at or before it, or zero
  // before any input exists.
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
