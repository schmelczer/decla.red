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
});
