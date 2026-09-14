import { clamp, settings } from 'shared';

const rateGain = 2;

const maxRateAdjustment = 0.25;

const resyncSeconds = 0.3;

class ServerTimeline {
  private cursor?: number;
  private newestSnapshotTime?: number;
  private newestReceivedAtMs = 0;
  public snapshotTime = 0;

  public get renderTime(): number {
    return this.cursor ?? 0;
  }

  public onSnapshot(timestamp: number) {
    this.snapshotTime = timestamp;
    if (this.newestSnapshotTime === undefined || timestamp > this.newestSnapshotTime) {
      this.newestSnapshotTime = timestamp;
      this.newestReceivedAtMs = performance.now();
    }
  }

  public step(deltaTimeInSeconds: number) {
    if (this.newestSnapshotTime === undefined) {
      return;
    }

    const target =
      this.newestSnapshotTime +
      (performance.now() - this.newestReceivedAtMs) / 1000 -
      settings.interpolationDelaySeconds;

    if (this.cursor === undefined || Math.abs(target - this.cursor) > resyncSeconds) {
      this.cursor = target;
      return;
    }

    this.cursor += deltaTimeInSeconds;
    this.cursor +=
      deltaTimeInSeconds *
      clamp((target - this.cursor) * rateGain, -maxRateAdjustment, maxRateAdjustment);
  }

  public reset() {
    this.cursor = undefined;
    this.newestSnapshotTime = undefined;
    this.newestReceivedAtMs = 0;
    this.snapshotTime = 0;
  }
}

export const serverTimeline = new ServerTimeline();
