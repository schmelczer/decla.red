// Reconciliation guard for the REAL client predictor. It exercises
// LocalCharacterPredictor end-to-end with an injected clock, verifying the two
// properties reconciliation depends on:
//   1. a fully-acknowledged snapshot reproduces the authoritative pose exactly
//      (no spurious drift on top of server truth), and
//   2. un-acknowledged input is replayed forward deterministically.
// This is the net for prediction-touching changes (the death-while-dead fix,
// future netcode work) — a regression shows up as drift or non-determinism.
import { describe, it, expect } from 'vitest';
import {
  LocalCharacterPredictor,
  setPredictorClockForTesting,
} from '../frontend/src/scripts/helper/prediction/local-character-predictor';

const HEAD_RADIUS = 50;
const FEET_RADIUS = 20;

// A Circle-shaped pose; the predictor only reads .center / .radius, so plain
// objects with array centres are sufficient (and avoid importing gl-matrix).
const poseAt = (cx: number, cy: number) => ({
  head: { center: [cx, cy + 37], radius: HEAD_RADIUS },
  leftFoot: { center: [cx - 33, cy - 18], radius: FEET_RADIUS },
  rightFoot: { center: [cx + 33, cy - 18], radius: FEET_RADIUS },
});

describe('local prediction reconciliation', () => {
  it('reproduces the authoritative pose exactly when all input is acknowledged', () => {
    let clock = 1000;
    setPredictorClockForTesting(() => clock);

    const predictor = new LocalCharacterPredictor();
    const auth = poseAt(500, 500);

    const t = predictor.recordInput([1, 0]);
    predictor.acknowledge(t, [0, 0], -Infinity); // server has consumed this input
    predictor.setStrength(80);
    predictor.setAuthoritative(auth.head as never, auth.leftFoot as never, auth.rightFoot as never);

    // No clock advance → zero replay window → predicted pose == authoritative.
    const used = predictor.update([], 1 / 60);

    expect(used).toBe(true);
    expect(predictor.head.center[0]).toBeCloseTo(auth.head.center[0], 5);
    expect(predictor.head.center[1]).toBeCloseTo(auth.head.center[1], 5);
    expect(predictor.leftFoot.center[0]).toBeCloseTo(auth.leftFoot.center[0], 5);
    expect(predictor.rightFoot.center[0]).toBeCloseTo(auth.rightFoot.center[0], 5);
  });

  it('replays un-acknowledged input deterministically', () => {
    const drive = () => {
      let clock = 0;
      setPredictorClockForTesting(() => clock);

      const predictor = new LocalCharacterPredictor();
      clock = 1000;
      predictor.acknowledge(900, [0, 0], -Infinity); // baseline ack (older than the input below)
      predictor.setStrength(80);
      const auth = poseAt(0, 0);
      predictor.setAuthoritative(auth.head as never, auth.leftFoot as never, auth.rightFoot as never);
      predictor.recordInput([1, 0]); // unacked rightward input at t=1000

      clock = 1100; // replay ~100 ms forward
      predictor.update([], 1 / 60);
      return [
        predictor.head.center[0],
        predictor.head.center[1],
        predictor.leftFoot.center[0],
        predictor.rightFoot.center[0],
      ];
    };

    const a = drive();
    const b = drive();
    expect(a).toEqual(b); // deterministic replay
    expect(a.every((n) => Number.isFinite(n))).toBe(true);
    expect(a[0]).toBeGreaterThan(0.5); // rightward input actually moved the body
  });

  it('suppresses prediction while the local player is dead', () => {
    let clock = 5000;
    setPredictorClockForTesting(() => clock);

    const predictor = new LocalCharacterPredictor();
    const auth = poseAt(200, 200);
    const t = predictor.recordInput([1, 0]);
    predictor.acknowledge(t, [0, 0], -Infinity);
    predictor.setStrength(80);
    predictor.setAuthoritative(auth.head as never, auth.leftFoot as never, auth.rightFoot as never);
    predictor.setAlive(false); // dead, awaiting respawn

    clock = 5200; // input + elapsed time that would otherwise be replayed forward
    // Even with a valid authoritative pose and pending input, a dead body must
    // not be predicted/moved — that was the "move while dead" bug.
    expect(predictor.update([], 1 / 60)).toBe(false);
  });

  // The replay window spans everything the server has not acknowledged, not just
  // the snapshot's age. Anchoring on the snapshot's arrival made the window just
  // that age, so prediction cancelled the interpolation buffer and nothing else
  // and the local body sat a full one-way trip behind the server.
  it('replays the whole un-acknowledged span, so a longer trip predicts further', () => {
    const driveWithUnackedSpan = (ackAgeMs: number) => {
      let clock = 0;
      setPredictorClockForTesting(() => clock);

      const predictor = new LocalCharacterPredictor();
      predictor.setStrength(80);
      // The key went down well before the acknowledged span and is still held —
      // the case that used to freeze the acknowledgement, because movement is
      // only transmitted when it changes.
      clock = 9_000;
      predictor.recordInput([1, 0]);

      clock = 10_000;
      const auth = poseAt(0, 0);
      // The server has confirmed input only up to `ackAgeMs` ago; the snapshot
      // carrying that acknowledgement arrives now.
      predictor.acknowledge(clock - ackAgeMs, [0, 0], -Infinity);
      predictor.setAuthoritative(
        auth.head as never,
        auth.leftFoot as never,
        auth.rightFoot as never,
      );

      predictor.update([], 1 / 60);
      return predictor.head.center[0];
    };

    const shortTrip = driveWithUnackedSpan(40);
    const longTrip = driveWithUnackedSpan(200);

    expect(shortTrip).toBeGreaterThan(0);
    // A 200 ms un-acknowledged span must predict meaningfully further ahead than
    // a 40 ms one; when the window was pinned to the snapshot they were equal.
    expect(longTrip).toBeGreaterThan(shortTrip * 2);
  });
  // ...but the anchor must not also inherit the AGE of whichever input happened
  // to be the newest one the server had when it took the snapshot. Input is sent
  // once per frame, so that age is 0..1 frame depending on where the client's
  // frames fell between two snapshots, and it walks a sawtooth: measured against
  // a real server on localhost it ran 5, 16, 12, 8, 3, 14, 9, 1 ms and so on.
  // Left in the window, it jumped the predicted body by up to a frame of travel
  // 25 times a second — the local body was choppy on a link with no latency at
  // all to hide it. The server reports the age with the acknowledgement so the
  // anchor lands on the snapshot instant instead.
  it('cancels the age of the acknowledged input, so the send cadence cannot beat', () => {
    // Both runs describe the SAME snapshot: taken 20 ms ago, of the same pose.
    // They differ only in how long before it the server's newest input arrived.
    const snapshotAgeMs = 20;
    const drive = (inputAgeMs: number, serverReportsAge: boolean) => {
      let clock = 0;
      setPredictorClockForTesting(() => clock);

      const predictor = new LocalCharacterPredictor();
      predictor.setStrength(80);
      clock = 9_000;
      predictor.recordInput([1, 0]); // held down throughout

      clock = 10_000;
      predictor.acknowledge(
        clock - snapshotAgeMs - inputAgeMs,
        [0, 0],
        -Infinity,
        serverReportsAge ? inputAgeMs : 0,
      );
      const auth = poseAt(0, 0);
      predictor.setAuthoritative(
        auth.head as never,
        auth.leftFoot as never,
        auth.rightFoot as never,
      );

      predictor.update([], 1 / 60);
      return predictor.head.center[0];
    };

    expect(drive(16, true)).toBeCloseTo(drive(0, true), 6);
    // And the difference being cancelled is a real one: uncancelled, the same
    // 16 ms moves the body, so the assertion above does not hold vacuously.
    expect(Math.abs(drive(16, false) - drive(0, false))).toBeGreaterThan(0.5);
  });
});
