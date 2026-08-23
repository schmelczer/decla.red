// Determinism guard: client predictor and server run the same stepCharacterMovement.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Numerics match production because test/setup.mjs has already applied
// glMatrix.setMatrixArrayType(Array) — without it this would pin f32.
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');

const {
  stepCharacterMovement,
  tickPlanetDetachment,
  resolveCircleMovement,
  planetDistance,
  planetGravity,
  PlanetBase,
  Random,
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

// Free-space world (no planets): exercises the deterministic core without planet SDF geometry.
const emptyWorld = {
  groundsNear: () => [],
  stepBody: (body, dt) => {
    resolveCircleMovement(body, dt, []);
    return undefined;
  },
};

const stepSeconds = 1 / 200;

// A spinning planet, built the way create-world builds one, so the SDF/gravity/on-surface branches have a pin too.
const makeSpinningPlanetWorld = () => {
  Random.seed = 20;
  const vertices = PlanetBase.createPlanetVertices(
    vec2.fromValues(0, -900),
    1700,
    1900,
    70,
  );
  const base = new PlanetBase(1, vertices);
  let rotation = 0;
  const surface = {
    canCollide: true,
    isGround: true,
    center: base.center,
    angularVelocity: 0.09,
    advance: (dt) => (rotation += surface.angularVelocity * dt),
    distance: (target) =>
      planetDistance(
        target,
        vertices,
        base.center,
        Math.cos(rotation),
        Math.sin(rotation),
      ),
    gravityAt: (target) => planetGravity(base.center, base.radius, target),
  };
  const grounds = [surface];
  return {
    surface,
    world: {
      groundsNear: () => grounds,
      stepBody: (body, dt) => {
        const { hitObject } = resolveCircleMovement(body, dt, grounds);
        return hitObject && hitObject.isGround ? hitObject : undefined;
      },
    },
  };
};

const runPlanetSimulation = () => {
  const { surface, world } = makeSpinningPlanetWorld();
  const start = vec2.fromValues(0, 250);
  const state = {
    head: makeBody(vec2.add(vec2.create(), start, headOffset), headRadius),
    leftFoot: makeBody(vec2.add(vec2.create(), start, leftFootOffset), feetRadius),
    rightFoot: makeBody(vec2.add(vec2.create(), start, rightFootOffset), feetRadius),
    direction: 0,
    currentPlanet: undefined,
    secondsSinceOnSurface: 1,
    bodyVelocity: vec2.create(),
  };

  for (let i = 0; i < 900; i++) {
    // Fall in, then walk right, then left.
    const input = i < 200 ? vec2.create() : vec2.fromValues(i < 600 ? 1 : -1, 0);
    tickPlanetDetachment(state, stepSeconds);
    stepCharacterMovement(state, world, input, stepSeconds);
    surface.advance(stepSeconds);
  }

  const round = (v) => Math.round(v * 1000) / 1000;
  return JSON.stringify({
    head: [round(state.head.center[0]), round(state.head.center[1])],
    leftFoot: [round(state.leftFoot.center[0]), round(state.leftFoot.center[1])],
    rightFoot: [round(state.rightFoot.center[0]), round(state.rightFoot.center[1])],
    direction: round(state.direction),
    onSurface: !!state.currentPlanet,
    secondsSinceOnSurface: round(state.secondsSinceOnSurface),
  });
};

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

  it('is deterministic on a spinning planet too', () => {
    expect(runPlanetSimulation()).toBe(runPlanetSimulation());
  });

  it('matches the pinned reference pose on a spinning planet', () => {
    expect(runPlanetSimulation()).toMatchSnapshot();
  });
});
