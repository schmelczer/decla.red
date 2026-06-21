// Determinism guard for the shared character simulation. The client predictor
// and the authoritative server run the EXACT same stepCharacterMovement; if it
// were non-deterministic (a stray Math.random / Date, or an order-dependent
// reduce) prediction would rubber-band and could never reconcile. This is also
// the regression net for the upcoming GC/scratch-pool perf rewrites: the pinned
// hash must not change unless physics behaviour is intentionally changed.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');

const {
  stepCharacterMovement,
  resolveCircleMovement,
  headRadius,
  feetRadius,
  headOffset,
  leftFootOffset,
  rightFootOffset,
} = shared;

const makeBody = (center, radius) => ({
  center: vec2.clone(center),
  radius,
  velocity: vec2.create(),
  lastNormal: vec2.fromValues(0, 1),
  restitution: 0,
});

// A free-space world (no planets): the body is driven purely by the movement
// input force, posture springs and momentum decay — enough to exercise the
// deterministic core without coupling the test to planet SDF geometry.
const emptyWorld = {
  groundsNear: () => [],
  stepBody: (body, dt) => {
    resolveCircleMovement(body, dt, []);
    return undefined;
  },
};

const stepSeconds = 1 / 200;

// Run a fixed, scripted input sequence through the shared sim and return a
// stable string snapshot of the final pose + carried momentum.
const runSimulation = () => {
  const start = vec2.fromValues(100, 100);
  const state = {
    head: makeBody(vec2.add(vec2.create(), start, headOffset), headRadius),
    leftFoot: makeBody(vec2.add(vec2.create(), start, leftFootOffset), feetRadius),
    rightFoot: makeBody(vec2.add(vec2.create(), start, rightFootOffset), feetRadius),
    direction: 0,
    currentPlanet: undefined,
    secondsSinceOnSurface: 1,
    bodyVelocity: vec2.create(),
  };

  for (let i = 0; i < 300; i++) {
    const angle = i * 0.1;
    const input = vec2.fromValues(Math.cos(angle), Math.sin(angle));
    stepCharacterMovement(state, emptyWorld, input, stepSeconds);
  }

  const round = (v) => Math.round(v * 1000) / 1000;
  return JSON.stringify({
    head: [round(state.head.center[0]), round(state.head.center[1])],
    leftFoot: [round(state.leftFoot.center[0]), round(state.leftFoot.center[1])],
    rightFoot: [round(state.rightFoot.center[0]), round(state.rightFoot.center[1])],
    bodyVelocity: [round(state.bodyVelocity[0]), round(state.bodyVelocity[1])],
  });
};

describe('shared character simulation determinism', () => {
  it('produces identical output across independent runs', () => {
    expect(runSimulation()).toBe(runSimulation());
  });

  it('matches the pinned reference pose (changes only with intentional physics edits)', () => {
    // Regression pin — update deliberately when physics behaviour changes.
    expect(runSimulation()).toMatchSnapshot();
  });
});
