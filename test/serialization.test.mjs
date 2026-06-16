// Round-trip tests for the custom wire serializer — the single most fragile,
// highest-blast-radius mechanism in the codebase (every networked message goes
// through it, and dispatch is keyed on class name). We exercise the BUILT shared
// bundle (shared/lib/main.js) rather than the TS source, so the decorators are
// already applied exactly as they ship and there is no transform/ESM ambiguity.
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
    // A clobbered name→constructor mapping (two classes sharing a name) would
    // surface here as an item deserializing to the wrong class.
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
