import { afterEach, describe, expect, it, vi } from 'vitest';
import { marchCircle } from '../shared/src/physics/march-circle';
import { resolveCircleMovement } from '../shared/src/physics/resolve-circle-movement';
import { finiteVec2, sanitizeName } from '../shared/src/helper/finite';
import { CommandReceiver } from '../shared/src/commands/command-receiver';
import type { PhysicsBody, Sdf } from '../shared/src/physics/sdf';

const bodyAt = (x: number, y: number, vx: number, vy: number): PhysicsBody => ({
  center: [x, y],
  radius: 1,
  velocity: [vx, vy],
  lastNormal: [0, 1],
  restitution: 1,
});

const rightWall: Sdf = { canCollide: true, distance: ([x]) => 10 - x };

describe('circle collision movement', () => {
  it('spends only the remaining step time after a bounce', () => {
    const body = bodyAt(0, 0, 100, 0);
    expect(resolveCircleMovement(body, 0.2, [rightWall])).toBe(rightWall);
    // 9 units to the wall, then 11 units back: 20 units of total travel.
    expect(body.center[0]).toBeCloseTo(-2, 6);
    expect(body.velocity[0]).toBeCloseTo(-100, 6);
  });

  it('resolves velocity at the second contact instead of leaving it aimed into a wall', () => {
    const body = bodyAt(0, 0, 100, 0);
    const leftWall: Sdf = { canCollide: true, distance: ([x]) => x + 5 };
    resolveCircleMovement(body, 0.3, [rightWall, leftWall]);
    expect(body.center[0]).toBeCloseTo(-4, 6);
    expect(body.velocity[0]).toBeCloseTo(100, 6);
  });

  it('allows slow tangential sliding along a surface', () => {
    const body = { ...bodyAt(9, 0, 100, 10), restitution: 0 };
    resolveCircleMovement(body, 0.1, [rightWall]);
    expect(body.center[0]).toBeCloseTo(9, 6);
    expect(body.center[1]).toBeCloseTo(1, 6);
    expect(body.velocity[0]).toBeCloseTo(0, 6);
  });

  it('ignores disabled objects when identifying the contacted surface', () => {
    const inactive: Sdf = { canCollide: false, distance: () => -100 };
    const onHit = vi.fn();
    const body = bodyAt(0, 0, 100, 0);
    const result = marchCircle(body, [20, 0], [inactive, rightWall], onHit);
    expect(result.hitObject).toBe(rightWall);
    expect(onHit).toHaveBeenCalledExactlyOnceWith(rightWall);
    expect(result.normal).toEqual([-1, 0]);
  });

  it('samples the collision normal before the callback removes the obstacle', () => {
    const wall = { ...rightWall };
    const body = bodyAt(0, 0, 100, 0);
    resolveCircleMovement(body, 0.2, [wall], () => {
      wall.canCollide = false;
    });
    expect(body.center.every(Number.isFinite)).toBe(true);
    expect(body.velocity[0]).toBeCloseTo(-100, 6);
  });
});

describe('network input helpers', () => {
  it('clamps huge finite vectors before allocating a float vector', () => {
    const direction = finiteVec2([1e300, 1e300], 1)!;
    expect(direction.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...direction)).toBeCloseTo(1, 6);
    expect(direction[0]).toBeGreaterThan(0.7);
  });

  it('never calls methods on an untrusted player name', () => {
    expect(sanitizeName({ toString: {} }, 10)).toBe('');
    expect(sanitizeName('abcdefghijk', 10)).toBe('abcdefghij');
  });

  it('does not dispatch inherited object methods as commands', () => {
    class Receiver extends CommandReceiver {
      public fallback = vi.fn();
      protected defaultCommandExecutor(command: object) {
        this.fallback(command);
      }
    }
    const receiver = new Receiver();
    const command = { constructor: { name: 'constructor' } };
    receiver.handleCommand(command);
    expect(receiver.fallback).toHaveBeenCalledExactlyOnceWith(command);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('random world seeds', () => {
  it('uses the random seed bits instead of truncating every initial seed to zero', async () => {
    const random = vi.spyOn(Math, 'random');
    const firstValues: number[] = [];
    for (const seed of [0.1, 0.5, 0.9]) {
      random.mockReturnValue(seed);
      vi.resetModules();
      const { Random } = await import('../shared/src/helper/random');
      firstValues.push(Random.getRandom());
      Random.seed = 42;
      const expected = [Random.getRandom(), Random.getRandom()];
      Random.seed = 42;
      expect([Random.getRandom(), Random.getRandom()]).toEqual(expected);
    }
    expect(new Set(firstValues).size).toBe(3);
  });
});
