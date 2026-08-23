import { clamp, settings } from 'shared';

const rateGain = 2;

const maxRateAdjustment = 0.25;

const resyncSeconds = 0.3;

class ServerTimeline {
  private cursor?: number;
  private newestSnapshotTime?: number;
  private sinceNewestSnapshot = 0;
  public snapshotTime = 0;

  public get renderTime(): number {
    return this.cursor ?? 0;
  }

  public onSnapshot(timestamp: number) {
    this.snapshotTime = timestamp;
    if (this.newestSnapshotTime === undefined || timestamp > this.newestSnapshotTime) {
      this.newestSnapshotTime = timestamp;
      this.sinceNewestSnapshot = 0;
    }
  }

  public step(deltaTimeInSeconds: number) {
    if (this.newestSnapshotTime === undefined) {
      return;
    }

    this.sinceNewestSnapshot += deltaTimeInSeconds;
    const target =
      this.newestSnapshotTime +
      this.sinceNewestSnapshot -
      settings.interpolationDelaySeconds;

    if (this.cursor === undefined || Math.abs(target - this.cursor) > resyncSeconds) {
      this.cursor = target;
      return;
    }

    const rate = clamp(
      1 + (target - this.cursor) * rateGain,
      1 - maxRateAdjustment,
      1 + maxRateAdjustment,
    );
    this.cursor += deltaTimeInSeconds * rate;
  }

  public reset() {
    this.cursor = undefined;
    this.newestSnapshotTime = undefined;
    this.sinceNewestSnapshot = 0;
    this.snapshotTime = 0;
  }
}

export const serverTimeline = new ServerTimeline();
