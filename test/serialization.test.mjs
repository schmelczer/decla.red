// Round-trip tests for the wire serializer, exercising the BUILT shared bundle.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');

const {
  serialize,
  deserialize,
  Circle,
  ServerAnnouncement,
  MoveActionCommand,
  UpdatePropertyCommand,
  PropertyUpdatesForObject,
  // networked entity bases — their toArray() must mirror their constructor order
  CharacterBase,
  PlanetBase,
  ProjectileBase,
  LampBase,
  // geometry — single source of truth shared by server & client prediction
  headRadius,
  feetRadius,
  boundRadius,
  headOffset,
  leftFootOffset,
  rightFootOffset,
} = shared;

describe('serialization round-trip (built shared lib)', () => {
  it('reconstructs a ServerAnnouncement as the right class with its payload', () => {
    const [out] = deserialize(serialize([new ServerAnnouncement('Hello <b>world</b>')]));
    expect(out).toBeInstanceOf(ServerAnnouncement);
    expect(out.text).toBe('Hello <b>world</b>');
  });

  it('round-trips a Circle and rounds floats to 3 decimals', () => {
    const out = deserialize(serialize(new Circle([12.34567, -7.1], 5.43219)));
    expect(out).toBeInstanceOf(Circle);
    // serialize.ts rounds every float via toFixed(3)
    expect(out.center[0]).toBeCloseTo(12.346, 6);
    expect(out.center[1]).toBeCloseTo(-7.1, 6);
    expect(out.radius).toBeCloseTo(5.432, 6);
  });

  it('keeps integer clientTimeMs exact (the predictor matches on it)', () => {
    const t = 1718000000123;
    const out = deserialize(serialize(new MoveActionCommand([1, 0], t)));
    expect(out).toBeInstanceOf(MoveActionCommand);
    expect(out.clientTimeMs).toBe(t);
  });

  it('round-trips nested property-update commands', () => {
    const out = deserialize(
      serialize(
        new PropertyUpdatesForObject(42, [new UpdatePropertyCommand('strength', 80, 8)]),
      ),
    );
    expect(out).toBeInstanceOf(PropertyUpdatesForObject);
    expect(out.id).toBe(42);
    expect(out.updates[0]).toBeInstanceOf(UpdatePropertyCommand);
    expect(out.updates[0].propertyKey).toBe('strength');
    expect(out.updates[0].propertyValue).toBe(80);
  });

  it('preserves per-item class identity across a mixed batch', () => {
    // A clobbered name→constructor mapping surfaces as the wrong class.
    const batch = [
      new ServerAnnouncement('a'),
      new MoveActionCommand([0, 1], 5),
      new Circle([1, 2], 3),
    ];
    const out = deserialize(serialize(batch));
    expect(out[0]).toBeInstanceOf(ServerAnnouncement);
    expect(out[1]).toBeInstanceOf(MoveActionCommand);
    expect(out[2]).toBeInstanceOf(Circle);
  });
});

describe('networked entity round-trips (toArray ↔ constructor contract)', () => {
  it('round-trips a ProjectileBase', () => {
    const out = deserialize(serialize(new ProjectileBase(7, [10, 20], 30, 'blue', 40)));
    expect(out).toBeInstanceOf(ProjectileBase);
    expect(out.id).toBe(7);
    expect(out.center[0]).toBeCloseTo(10, 5);
    expect(out.center[1]).toBeCloseTo(20, 5);
    expect(out.radius).toBe(30);
    expect(out.team).toBe('blue');
    expect(out.strength).toBe(40);
  });

  it('round-trips a CharacterBase with its nested body Circles', () => {
    const out = deserialize(
      serialize(
        new CharacterBase(
          8,
          'Bob',
          2,
          1,
          'red',
          100,
          new Circle([1, 2], 50),
          new Circle([3, 4], 20),
          new Circle([5, 6], 20),
        ),
      ),
    );
    expect(out).toBeInstanceOf(CharacterBase);
    expect(out.id).toBe(8);
    expect(out.name).toBe('Bob');
    expect(out.killCount).toBe(2);
    expect(out.deathCount).toBe(1);
    expect(out.team).toBe('red');
    expect(out.health).toBe(100);
    expect(out.head).toBeInstanceOf(Circle);
    expect(out.head.center[0]).toBeCloseTo(1, 5);
    expect(out.head.radius).toBe(50);
  });

  it('round-trips a LampBase', () => {
    const out = deserialize(serialize(new LampBase(9, [7, 8], [1, 0.5, 0.2], 0.8)));
    expect(out).toBeInstanceOf(LampBase);
    expect(out.center[1]).toBeCloseTo(8, 5);
    expect(out.color[2]).toBeCloseTo(0.2, 5);
    expect(out.lightness).toBeCloseTo(0.8, 5);
  });

  it('round-trips a PlanetBase (derived centre/radius recomputed from vertices)', () => {
    const out = deserialize(
      serialize(new PlanetBase(10, [[0, 0], [100, 0], [50, 100]], 0.7, true)),
    );
    expect(out).toBeInstanceOf(PlanetBase);
    expect(out.id).toBe(10);
    expect(out.vertices).toHaveLength(3);
    expect(out.ownership).toBeCloseTo(0.7, 5);
    expect(out.isKeystone).toBe(true);
    expect(out.center[0]).toBeCloseTo(50, 5); // recomputed by the constructor
  });
});

describe('shared character geometry — single source of truth', () => {
  it('matches the known body layout', () => {
    expect(headRadius).toBe(50);
    expect(feetRadius).toBe(20);
    expect(boundRadius).toBe((headRadius + feetRadius * 2) * 2); // 180
  });

  it('posture offsets are measured from the centre of mass (they sum to ~0)', () => {
    const sx = headOffset[0] + leftFootOffset[0] + rightFootOffset[0];
    const sy = headOffset[1] + leftFootOffset[1] + rightFootOffset[1];
    expect(sx).toBeCloseTo(0, 4);
    expect(sy).toBeCloseTo(0, 4);
  });
});
