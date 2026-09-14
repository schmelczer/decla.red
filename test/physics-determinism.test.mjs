import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');

const {
  stepCharacterMovement,
  tickPlanetDetachment,
  resolveCircleMovement,
  PlanetBase,
  Random,
  headRadius,
  feetRadius,
  headOffset,
  leftFootOffset,
  rightFootOffset,
} = shared;

const stepSeconds = 1 / 200;

const makeBody = (center, radius) => ({
  center: vec2.clone(center),
  radius,
  velocity: vec2.create(),
  lastNormal: vec2.fromValues(0, 1),
  restitution: 0,
});

const makeState = (start) => ({
  head: makeBody(vec2.add(vec2.create(), start, headOffset), headRadius),
  leftFoot: makeBody(vec2.add(vec2.create(), start, leftFootOffset), feetRadius),
  rightFoot: makeBody(vec2.add(vec2.create(), start, rightFootOffset), feetRadius),
  direction: 0,
  currentPlanet: undefined,
  secondsSinceOnSurface: 1,
  bodyVelocity: vec2.create(),
});

const makeWorld = (grounds) => ({
  groundsNear: () => grounds,
  stepBody: (body, dt) => {
    const hit = resolveCircleMovement(body, dt, grounds);
    return hit && hit.isGround ? hit : undefined;
  },
});

const round = (v) => Math.round(v * 1000) / 1000;
const roundVec = (v) => [round(v[0]), round(v[1])];

const runSimulation = () => {
  const state = makeState(vec2.fromValues(100, 100));
  const world = makeWorld([]);

  for (let i = 0; i < 300; i++) {
    const angle = i * 0.1;
    stepCharacterMovement(
      state,
      world,
      vec2.fromValues(Math.cos(angle), Math.sin(angle)),
      stepSeconds,
    );
  }

  return JSON.stringify({
    head: roundVec(state.head.center),
    leftFoot: roundVec(state.leftFoot.center),
    rightFoot: roundVec(state.rightFoot.center),
    bodyVelocity: roundVec(state.bodyVelocity),
  });
};

const runPlanetSimulation = () => {
  Random.seed = 20;
  const planet = new PlanetBase(
    1,
    PlanetBase.createPlanetVertices(vec2.fromValues(0, -900), 1700, 1900, 70),
  );
  planet.angularVelocity = 0.09;
  const world = makeWorld([planet]);
  const state = makeState(vec2.fromValues(0, 250));

  for (let i = 0; i < 900; i++) {
    const input = i < 200 ? vec2.create() : vec2.fromValues(i < 600 ? 1 : -1, 0);
    tickPlanetDetachment(state, stepSeconds);
    stepCharacterMovement(state, world, input, stepSeconds);
    planet.advanceRotation(stepSeconds);
  }

  return JSON.stringify({
    head: roundVec(state.head.center),
    leftFoot: roundVec(state.leftFoot.center),
    rightFoot: roundVec(state.rightFoot.center),
    direction: round(state.direction),
    onSurface: !!state.currentPlanet,
    secondsSinceOnSurface: round(state.secondsSinceOnSurface),
  });
};

describe('shared character simulation determinism', () => {
  it('does not depend on configuring vector precision before imports', () => {
    const run = (configureBeforeImport) =>
      execFileSync(
        process.execPath,
        [
          '-e',
          `
      const { glMatrix, vec2 } = require('./shared/node_modules/gl-matrix');
      if (${configureBeforeImport}) glMatrix.setMatrixArrayType(Array);
      const s = require('./shared/lib/main.js');
      glMatrix.setMatrixArrayType(Array);
      const body = (offset, radius) => ({
        center: vec2.clone(offset), radius, velocity: vec2.create(),
        lastNormal: [0, 1], restitution: 0,
      });
      const state = {
        head: body(s.headOffset, s.headRadius),
        leftFoot: body(s.leftFootOffset, s.feetRadius),
        rightFoot: body(s.rightFootOffset, s.feetRadius),
        direction: 0, currentPlanet: undefined,
        secondsSinceOnSurface: 1, bodyVelocity: [0, 0],
      };
      const world = {
        groundsNear: () => [],
        stepBody: (body, dt) => s.resolveCircleMovement(body, dt, []),
      };
      for (let i = 0; i < 100; i++) s.stepCharacterMovement(state, world, [1, 0], 0.005);
      process.stdout.write(JSON.stringify(state));
    `,
        ],
        { encoding: 'utf8' },
      );
    expect(run(false)).toBe(run(true));
  });

  it('produces identical output across independent runs', () => {
    expect(runSimulation()).toBe(runSimulation());
  });

  it('matches the pinned reference pose (changes only with intentional physics edits)', () => {
    expect(runSimulation()).toMatchSnapshot();
  });

  it('is deterministic on a spinning planet too', () => {
    expect(runPlanetSimulation()).toBe(runPlanetSimulation());
  });

  it('matches the pinned reference pose on a spinning planet', () => {
    expect(runPlanetSimulation()).toMatchSnapshot();
  });
});
