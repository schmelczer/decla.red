import { clamp, settings } from 'shared';

// Convergence rate of the playback cursor towards its target; a deviation
// decays with a time constant of 1 / rateGain seconds.
const rateGain = 2;

// Playback speed stays within [0.75, 1.25]× so corrections are invisible.
const maxRateAdjustment = 0.25;

// Beyond this divergence (tab was in the background, server changed) chasing
// the target is pointless: jump straight to it.
const resyncSeconds = 0.3;

/**
 * The playback clock for state streamed from the server.
 *
 * Snapshot timestamps estimate the server's clock: the newest received
 * timestamp plus the time elapsed since it arrived. Rendering happens
 * settings.interpolationDelaySeconds behind that estimate, so there is
 * normally a newer snapshot to interpolate towards and network jitter is
 * absorbed by the buffer instead of being shown.
 *
 * The cursor never jumps under normal operation: it runs at a gently adjusted
 * rate to stay on target and only snaps after a long divergence.
 */
class ServerTimeline {
  private cursor?: number;
  private newestSnapshotTime?: number;
  private sinceNewestSnapshot = 0;
  private _snapshotTime = 0;

  /** Timestamp of the update batch currently being applied. */
  public get snapshotTime(): number {
    return this._snapshotTime;
  }

  /** The point on the server's clock that should be rendered this frame. */
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
