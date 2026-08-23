import { mix } from 'shared';
import { serverTimeline } from '../server-timeline';

interface Frame {
  time: number;
  value: number;
  velocity: number;
}

const maxCoastSeconds = 0.06;

const blendSeconds = 0.12;

const maxFrames = 32;

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
    const newest = this.frames.length > 0 ? this.frames[this.frames.length - 1] : null;
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
