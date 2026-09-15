import { describe, it, expect } from 'vitest';
import { settings } from '../shared/src/settings';
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

    const used = predictor.update([]);

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
      predictor.update([]);
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
    expect(predictor.update([])).toBe(false);
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

      predictor.update([]);
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

      predictor.update([]);
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
      predictor.update([]);
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

const settledPoseAt = (x: number) => ({
  head: { center: [x, 55 - 55 / 3], radius: HEAD_RADIUS },
  leftFoot: { center: [x - 20, -55 / 3], radius: FEET_RADIUS },
  rightFoot: { center: [x + 20, -55 / 3], radius: FEET_RADIUS },
});

const install = (predictor: LocalCharacterPredictor, timeMs: number, x: number) => {
  const pose = settledPoseAt(x);
  predictor.acknowledge(timeMs, movementState() as never, -Infinity);
  predictor.setAuthoritative(
    pose.head as never,
    pose.leftFoot as never,
    pose.rightFoot as never,
  );
};

describe('prediction corrections and interruptions', () => {
  it('blends an authoritative correction and converges without slowing ordinary motion', () => {
    const predictor = new LocalCharacterPredictor();
    setFrameTimeMs(1000);
    install(predictor, 1000, 0);
    predictor.update([]);

    setFrameTimeMs(1016);
    install(predictor, 1016, 100);
    predictor.update([]);
    expect(predictor.head.center[0]).toBeCloseTo(0, 5);

    setFrameTimeMs(1032);
    predictor.update([]);
    expect(predictor.head.center[0]).toBeGreaterThan(0);
    expect(predictor.head.center[0]).toBeLessThan(100);

    setFrameTimeMs(1516);
    predictor.update([]);
    expect(predictor.head.center[0]).toBeCloseTo(100, 0);
  });

  it('freezes at the replay horizon during an outage even if held input changes', () => {
    const predictor = new LocalCharacterPredictor();
    setFrameTimeMs(0);
    install(predictor, 0, 0);
    predictor.recordInput([1, 0] as never);
    setFrameTimeMs(400);
    predictor.update([]);
    const frozen = [...predictor.head.center];

    setFrameTimeMs(450);
    predictor.recordInput([-1, 0] as never);
    setFrameTimeMs(600);
    predictor.update([]);
    expect([...predictor.head.center]).toEqual(frozen);

    setFrameTimeMs(2000);
    predictor.recordInput([0, 0] as never);
    setFrameTimeMs(2500);
    predictor.update([]);
    expect([...predictor.head.center]).toEqual(frozen);
  });

  it('clears visual correction on respawn and disables prediction for end-game snapshots', () => {
    const predictor = new LocalCharacterPredictor();
    setFrameTimeMs(1000);
    install(predictor, 1000, 0);
    predictor.update([]);
    install(predictor, 1000, 100);
    predictor.update([]);
    predictor.reset();
    install(predictor, 1000, 1000);
    predictor.update([]);
    expect(predictor.head.center[0]).toBe(1000);
    predictor.enabled = false;
    expect(predictor.update([])).toBe(false);
    predictor.reset();
    install(predictor, 1000, 1000);
    expect(predictor.update([])).toBe(false);
  });
});

const ground = {
  id: 1,
  vertices: Array.from({ length: 15 }, (_, i) => {
    const angle = (i / 15) * -Math.PI * 2;
    return [800 * Math.cos(angle), 800 * Math.sin(angle)];
  }),
  snapshotRotation: 0,
  snapshotRotationSpeed: 0,
};

const leapHeight = (cooldown: number, leap: boolean) => {
  const predictor = new LocalCharacterPredictor();
  setFrameTimeMs(1000);
  const pose = poseAt(0, 900);
  predictor.acknowledge(
    1000,
    {
      ...movementState(),
      groundPlanetId: 1,
      secondsSinceOnSurface: 0,
      leapCooldownRemaining: cooldown,
    } as never,
    -Infinity,
  );
  predictor.setAuthoritative(
    pose.head as never,
    pose.leftFoot as never,
    pose.rightFoot as never,
  );
  if (leap) predictor.recordLeap();
  setFrameTimeMs(1002);
  predictor.update([ground] as never);
  return predictor.head.center[1];
};

describe('leap prediction', () => {
  it('applies a newly pressed leap in the very next fractional render tick', () => {
    expect(leapHeight(0, true)).toBeGreaterThan(leapHeight(0, false) + 1);
  });

  it('does not predict a leap the authoritative cooldown will reject', () => {
    expect(leapHeight(0.2, true)).toEqual(leapHeight(0.2, false));
  });
});

describe('leap availability', () => {
  const prepare = (
    cooldown = 0,
    strength = settings.leapStrengthCost,
    groundPlanetId: number | null = ground.id,
  ) => {
    const predictor = new LocalCharacterPredictor();
    setFrameTimeMs(1000);
    const pose = poseAt(0, 900);
    predictor.acknowledge(
      1000,
      {
        ...movementState(),
        groundPlanetId,
        secondsSinceOnSurface: 0,
        leapCooldownRemaining: cooldown,
      } as never,
      -Infinity,
    );
    predictor.setStrength(strength);
    predictor.setAuthoritative(
      pose.head as never,
      pose.leftFoot as never,
      pose.rightFoot as never,
    );
    predictor.update([ground] as never);
    return { predictor, pose };
  };

  it('requires a planet, sufficient strength, and an expired cooldown', () => {
    expect(new LocalCharacterPredictor().canLeap).toBe(false);
    expect(prepare().predictor.canLeap).toBe(true);
    expect(prepare(0.2).predictor.canLeap).toBe(false);
    expect(prepare(0, settings.leapStrengthCost - 1).predictor.canLeap).toBe(false);
    expect(prepare(0, settings.playerMaxStrength, null).predictor.canLeap).toBe(false);
  });

  it('becomes available as the predicted cooldown and strength recover', () => {
    const { predictor } = prepare(0.02, settings.leapStrengthCost - 1);
    expect(predictor.canLeap).toBe(false);
    setFrameTimeMs(1030);
    predictor.update([ground] as never);
    expect(predictor.canLeap).toBe(true);
  });

  it('disables immediately after a leap and stays unavailable in flight', () => {
    const { predictor } = prepare();
    predictor.recordLeap();
    expect(predictor.canLeap).toBe(false);
    setFrameTimeMs(1002);
    predictor.update([ground] as never);
    expect(predictor.canLeap).toBe(false);
    setFrameTimeMs(1380);
    predictor.update([ground] as never);
    expect(predictor.canLeap).toBe(false);
  });

  it('clears availability on death, reset, spawn animation, and game end', () => {
    const { predictor, pose } = prepare();
    predictor.setAlive(false);
    expect(predictor.canLeap).toBe(false);
    predictor.update([ground] as never);
    predictor.setAlive(true);
    expect(predictor.canLeap).toBe(false);
    predictor.update([ground] as never);
    expect(predictor.canLeap).toBe(true);

    predictor.enabled = false;
    expect(predictor.canLeap).toBe(false);
    predictor.enabled = true;
    predictor.setAuthoritative(
      { ...pose.head, radius: 10 } as never,
      pose.leftFoot as never,
      pose.rightFoot as never,
    );
    expect(predictor.canLeap).toBe(false);
    predictor.reset();
    expect(predictor.canLeap).toBe(false);
  });
});
