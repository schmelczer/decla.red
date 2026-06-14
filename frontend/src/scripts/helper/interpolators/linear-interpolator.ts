import { last, mix } from 'shared';
import { serverTimeline } from '../server-timeline';

interface Frame {
  time: number;
  value: number;
  velocity: number;
}

// How far past the newest snapshot the value may coast on its last known
// velocity (network hiccup) before freezing in place.
const maxCoastSeconds = 0.06;

// When fresh snapshots arrive after a coast, they usually disagree with where
// the coast ended up; the difference decays away with this time constant
// instead of being shown as a jump.
const blendSeconds = 0.12;

// At 25 snapshots per second this spans over a second of state, far more than
// rendering ever needs; it only bounds memory while the tab is hidden and
// snapshots keep arriving without being consumed.
const maxFrames = 32;

/**
 * Replays a server-streamed scalar by interpolating between timestamped
 * snapshots at the shared timeline's render time, which trails the newest
 * snapshot. The streamed rate of change is only used to coast briefly when
 * the buffer runs dry.
 */
export class LinearInterpolator {
  private frames: Array<Frame> = [];
  private blendOffset = 0;
  private lastValue: number;
  private isCoasting = false;

  constructor(private readonly initialValue: number) {
    this.lastValue = initialValue;
  }

  public addFrame(value: number, rateOfChange: number) {
    const time = serverTimeline.snapshotTime;
    const newest = last(this.frames);
    const wasCoasting = this.isCoasting;

    if (newest && time <= newest.time) {
      this.frames[this.frames.length - 1] = {
        time: newest.time,
        value,
        velocity: rateOfChange,
      };
    } else {
      this.frames.push({ time, value, velocity: rateOfChange });
      if (this.frames.length > maxFrames) {
        this.frames.shift();
      }
    }

    if (wasCoasting) {
      // Continue from where the coast left off and let the offset decay,
      // instead of jumping onto the freshly revealed trajectory.
      this.blendOffset = this.lastValue - this.sample(serverTimeline.renderTime);
    }
  }

  public getValue(deltaTimeInSeconds: number): number {
    this.blendOffset *= Math.exp(-deltaTimeInSeconds / blendSeconds);
    return (this.lastValue = this.sample(serverTimeline.renderTime) + this.blendOffset);
  }

  private sample(time: number): number {
    if (this.frames.length === 0) {
      return this.initialValue;
    }

    while (this.frames.length >= 2 && this.frames[1].time <= time) {
      this.frames.shift();
    }

    const [current, next] = this.frames;
    this.isCoasting = false;

    if (time <= current.time) {
      return current.value;
    }

    if (next) {
      return mix(
        current.value,
        next.value,
        (time - current.time) / (next.time - current.time),
      );
    }

    this.isCoasting = true;
    return (
      current.value + current.velocity * Math.min(time - current.time, maxCoastSeconds)
    );
  }
}
