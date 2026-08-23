import { describe, it, expect } from 'vitest';
import {
  LocalCharacterPredictor,
  setFrameTimeMs,
} from '../frontend/src/scripts/helper/prediction/local-character-predictor';

const HEAD_RADIUS = 50;
const FEET_RADIUS = 20;

const poseAt = (cx: number, cy: number) => ({
  head: { center: [cx, cy + 37], radius: HEAD_RADIUS },
  leftFoot: { center: [cx - 33, cy - 18], radius: FEET_RADIUS },
  rightFoot: { center: [cx + 33, cy - 18], radius: FEET_RADIUS },
});

const movementState = (direction = 0) => ({
  direction,
  bodyVelocity: [0, 0],
  leftFootNormal: [0, 1],
  rightFootNormal: [0, 1],
  groundPlanetId: null,
  secondsSinceOnSurface: 1,
});

describe('local prediction reconciliation', () => {
  it('reproduces the authoritative pose exactly when all input is acknowledged', () => {
    setFrameTimeMs(1000);

    const predictor = new LocalCharacterPredictor();
    const auth = poseAt(500, 500);

    const t = predictor.recordInput([1, 0]);
    predictor.acknowledge(t, movementState() as never, -Infinity);
    predictor.setStrength(80);
    predictor.setAuthoritative(
      auth.head as never,
      auth.leftFoot as never,
      auth.rightFoot as never,
    );

    const used = predictor.update([], 1 / 60);

    expect(used).toBe(true);
    expect(predictor.head.center[0]).toBeCloseTo(auth.head.center[0], 5);
    expect(predictor.head.center[1]).toBeCloseTo(auth.head.center[1], 5);
    expect(predictor.leftFoot.center[0]).toBeCloseTo(auth.leftFoot.center[0], 5);
    expect(predictor.rightFoot.center[0]).toBeCloseTo(auth.rightFoot.center[0], 5);
  });

  it('replays un-acknowledged input deterministically', () => {
    const drive = () => {
      const predictor = new LocalCharacterPredictor();
      setFrameTimeMs(1000);
      predictor.acknowledge(900, movementState() as never, -Infinity);
      predictor.setStrength(80);
      const auth = poseAt(0, 0);
      predictor.setAuthoritative(
        auth.head as never,
        auth.leftFoot as never,
        auth.rightFoot as never,
      );
      predictor.recordInput([1, 0]);

      setFrameTimeMs(1100);
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
    expect(a).toEqual(b);
    expect(a.every((n) => Number.isFinite(n))).toBe(true);
    expect(a[0]).toBeGreaterThan(0.5);
  });

  it('suppresses prediction while the local player is dead', () => {
    setFrameTimeMs(5000);

    const predictor = new LocalCharacterPredictor();
    const auth = poseAt(200, 200);
    const t = predictor.recordInput([1, 0]);
    predictor.acknowledge(t, movementState() as never, -Infinity);
    predictor.setStrength(80);
    predictor.setAuthoritative(
      auth.head as never,
      auth.leftFoot as never,
      auth.rightFoot as never,
    );
    predictor.setAlive(false);

    setFrameTimeMs(5200);
    expect(predictor.update([], 1 / 60)).toBe(false);
  });

  it('replays the whole un-acknowledged span, so a longer trip predicts further', () => {
    const driveWithUnackedSpan = (ackAgeMs: number) => {
      const predictor = new LocalCharacterPredictor();
      predictor.setStrength(80);
      setFrameTimeMs(9_000);
      predictor.recordInput([1, 0]);

      setFrameTimeMs(10_000);
      const auth = poseAt(0, 0);
      predictor.acknowledge(10_000 - ackAgeMs, movementState() as never, -Infinity);
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
    expect(longTrip).toBeGreaterThan(shortTrip * 2);
  });

  it('cancels the age of the acknowledged input, so the send cadence cannot beat', () => {
    const snapshotAgeMs = 20;
    const drive = (inputAgeMs: number, serverReportsAge: boolean) => {
      const predictor = new LocalCharacterPredictor();
      predictor.setStrength(80);
      setFrameTimeMs(9_000);
      predictor.recordInput([1, 0]);

      setFrameTimeMs(10_000);
      predictor.acknowledge(
        10_000 - snapshotAgeMs - inputAgeMs,
        movementState() as never,
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
    expect(Math.abs(drive(16, false) - drive(0, false))).toBeGreaterThan(0.5);
  });

  it('replays the streamed facing direction, not one guessed from the pose', () => {
    const walkingPose = () => ({
      head: { center: [-35, 37], radius: HEAD_RADIUS },
      leftFoot: { center: [-33, -18], radius: FEET_RADIUS },
      rightFoot: { center: [33, -18], radius: FEET_RADIUS },
    });

    const predictWithDirection = (direction: number) => {
      const predictor = new LocalCharacterPredictor();
      predictor.setStrength(80);
      setFrameTimeMs(0);
      predictor.recordInput([1, 0]);
      predictor.acknowledge(0, movementState(direction) as never, -Infinity);
      const auth = walkingPose();
      predictor.setAuthoritative(
        auth.head as never,
        auth.leftFoot as never,
        auth.rightFoot as never,
      );

      setFrameTimeMs(40);
      predictor.update([], 1 / 60);
      return [predictor.head.center[0], predictor.head.center[1]];
    };

    const upright = predictWithDirection(0);
    const asThePoseImplies = predictWithDirection(0.566);
    const apart = Math.hypot(
      upright[0] - asThePoseImplies[0],
      upright[1] - asThePoseImplies[1],
    );

    expect(apart).toBeGreaterThan(1);
  });
});
