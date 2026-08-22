import { clamp, settings } from 'shared';

const rateGain = 2;

const maxRateAdjustment = 0.25;

const resyncSeconds = 0.3;

/**
 * Playback clock for streamed server state — renders interpolationDelaySeconds
 * behind the server clock so a newer snapshot is usually available; the cursor
 * adjusts its rate gently and only snaps after a long divergence.
 */
class ServerTimeline {
  private cursor?: number;
  private newestSnapshotTime?: number;
  private sinceNewestSnapshot = 0;
  private _snapshotTime = 0;

  public get snapshotTime(): number {
    return this._snapshotTime;
  }

  public get renderTime(): number {
    return this.cursor ?? 0;
  }

  public onSnapshot(timestamp: number) {
    this._snapshotTime = timestamp;
    if (this.newestSnapshotTime === undefined || timestamp > this.newestSnapshotTime) {
      this.newestSnapshotTime = timestamp;
      this.sinceNewestSnapshot = 0;
    }
  }

  // Must be called with unscaled wall-clock time, even during the end-game
  // slow motion: the slowdown is already baked into the snapshots.
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
    this._snapshotTime = 0;
  }
}

export const serverTimeline = new ServerTimeline();
