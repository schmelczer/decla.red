import { vec2 } from 'gl-matrix';
import { settings } from '../settings';
import { GroundSurface, PhysicsBody } from './sdf';
import { interpolateAngles } from './interpolate-angles';
import { smoothing } from '../helper/ease';

export const headRadius = 50;
export const feetRadius = 20;

// Imports run before setMatrixArrayType(Array): keep these fractional constants in f64.
const centerHeight = 55 * (1 / 3);
export const headOffset: vec2 = [0, 55 - centerHeight];
export const leftFootOffset: vec2 = [-20, -centerHeight];
export const rightFootOffset: vec2 = [20, -centerHeight];
export const boundRadius = (headRadius + feetRadius * 2) * 2;

export interface CharacterMovementState {
  readonly head: PhysicsBody;
  readonly leftFoot: PhysicsBody;
  readonly rightFoot: PhysicsBody;
  direction: number;
  currentPlanet: GroundSurface | undefined;
  secondsSinceOnSurface: number;
  bodyVelocity: vec2;
}

export interface CharacterWorld {
  groundsNear(center: vec2, radius: number): Array<GroundSurface>;
  stepBody(body: PhysicsBody, deltaTimeInSeconds: number): GroundSurface | undefined;
}

export const applyForce = (
  body: PhysicsBody,
  force: vec2,
  deltaTimeInSeconds: number,
) => {
  vec2.scaleAndAdd(body.velocity, body.velocity, force, deltaTimeInSeconds);
};

// ((head + leftFoot) + rightFoot) / 3 — do not reassociate.
export const characterCenter = (
  head: { center: vec2 },
  leftFoot: { center: vec2 },
  rightFoot: { center: vec2 },
): vec2 => {
  const center = vec2.add(vec2.create(), head.center, leftFoot.center);
  vec2.add(center, center, rightFoot.center);
  return vec2.scale(center, center, 1 / 3);
};

// Tuned so one physics step still turns the same 20% it always did, but a replay that splits
// or merges steps now lands on the same facing instead of one that depends on the step count.
const directionSmoothingSeconds =
  settings.targetPhysicsDeltaTimeInSeconds / Math.log(1 / (1 - 0.2));

const setDirection = (
  state: CharacterMovementState,
  direction: vec2,
  deltaTimeInSeconds: number,
) => {
  state.direction = interpolateAngles(
    state.direction,
    Math.atan2(direction[1], direction[0]) + Math.PI / 2,
    smoothing(deltaTimeInSeconds, directionSmoothingSeconds),
  );
};

const springMove = (
  state: CharacterMovementState,
  body: PhysicsBody,
  center: vec2,
  offset: vec2,
  stiffness: number,
) => {
  const desiredPosition = vec2.add(vec2.create(), center, offset);
  vec2.rotate(desiredPosition, desiredPosition, center, state.direction);
  const positionDelta = vec2.subtract(vec2.create(), desiredPosition, body.center);
  vec2.scaleAndAdd(body.velocity, body.velocity, positionDelta, stiffness);
};

const keepPosture = (state: CharacterMovementState) => {
  const center = characterCenter(state.head, state.leftFoot, state.rightFoot);
  springMove(
    state,
    state.leftFoot,
    center,
    leftFootOffset,
    settings.postureFeetStiffness,
  );
  springMove(
    state,
    state.rightFoot,
    center,
    rightFootOffset,
    settings.postureFeetStiffness,
  );
  springMove(state, state.head, center, headOffset, settings.postureHeadStiffness);
};

const carryWithRotatingPlanet = (
  state: CharacterMovementState,
  deltaTimeInSeconds: number,
) => {
  const planet = state.currentPlanet;
  if (!planet) {
    return;
  }
  const angle = -planet.angularVelocity * deltaTimeInSeconds;
  for (const body of [state.head, state.leftFoot, state.rightFoot]) {
    vec2.rotate(body.center, body.center, planet.center, angle);
  }
};

export const applyLeapImpulse = (state: CharacterMovementState, moveDirection: vec2) => {
  const planet = state.currentPlanet;
  if (!planet) {
    return;
  }

  const up = vec2.add(
    vec2.create(),
    state.leftFoot.lastNormal,
    state.rightFoot.lastNormal,
  );
  if (vec2.length(up) === 0) {
    vec2.set(up, 0, 1);
  } else {
    vec2.normalize(up, up);
  }

  const launch = vec2.scale(vec2.create(), up, settings.leapUpBias);
  if (vec2.length(moveDirection) > 0) {
    vec2.scaleAndAdd(
      launch,
      launch,
      vec2.normalize(vec2.create(), moveDirection),
      settings.leapMoveBias,
    );
  }
  vec2.normalize(launch, launch);
  vec2.scaleAndAdd(state.bodyVelocity, state.bodyVelocity, launch, settings.leapSpeed);

  const center = characterCenter(state.head, state.leftFoot, state.rightFoot);
  const omega = planet.angularVelocity;
  const surfaceVelocity = vec2.fromValues(
    omega * (center[1] - planet.center[1]),
    -omega * (center[0] - planet.center[0]),
  );
  vec2.scaleAndAdd(
    state.bodyVelocity,
    state.bodyVelocity,
    surfaceVelocity,
    settings.slingshotScale,
  );

  state.currentPlanet = undefined;
  state.secondsSinceOnSurface = settings.planetDetachmentSeconds;
};

export const tickPlanetDetachment = (
  state: CharacterMovementState,
  deltaTimeInSeconds: number,
) => {
  if (
    (state.secondsSinceOnSurface += deltaTimeInSeconds) > settings.planetDetachmentSeconds
  ) {
    state.currentPlanet = undefined;
  }
};

const applyBodyMomentum = (state: CharacterMovementState) => {
  if (vec2.squaredLength(state.bodyVelocity) === 0) {
    return;
  }
  vec2.add(state.leftFoot.velocity, state.leftFoot.velocity, state.bodyVelocity);
  vec2.add(state.rightFoot.velocity, state.rightFoot.velocity, state.bodyVelocity);
  vec2.add(state.head.velocity, state.head.velocity, state.bodyVelocity);
};

export const decayMomentum = (
  bodyVelocity: vec2,
  onGround: boolean,
  deltaTimeInSeconds: number,
) => {
  const speed = vec2.length(bodyVelocity);
  if (speed === 0) {
    return;
  }
  const friction = onGround
    ? settings.groundMomentumFriction
    : settings.airMomentumFriction;
  const target = Math.min(
    speed * Math.exp(-friction * deltaTimeInSeconds) -
      settings.momentumStopDeceleration * deltaTimeInSeconds,
    settings.maxBodyMomentum,
  );
  if (target <= 1) {
    vec2.zero(bodyVelocity);
  } else {
    vec2.scale(bodyVelocity, bodyVelocity, target / speed);
  }
};

export const sumGravity = (grounds: Array<GroundSurface>, position: vec2): vec2 =>
  grounds.reduce(
    (sum, ground) => vec2.add(sum, sum, ground.gravityAt(position)),
    vec2.create(),
  );

const latchGround = (
  state: CharacterMovementState,
  ground: GroundSurface | undefined,
) => {
  if (ground) {
    state.secondsSinceOnSurface = 0;
    state.currentPlanet = ground;
  }
};

export const stepCharacterMovement = (
  state: CharacterMovementState,
  world: CharacterWorld,
  inputDirection: vec2,
  deltaTimeInSeconds: number,
) => {
  vec2.zero(state.head.velocity);
  vec2.zero(state.leftFoot.velocity);
  vec2.zero(state.rightFoot.velocity);

  const movementForce = vec2.scale(
    vec2.create(),
    inputDirection,
    settings.maxAcceleration,
  );
  applyForce(state.leftFoot, movementForce, deltaTimeInSeconds);
  applyForce(state.rightFoot, movementForce, deltaTimeInSeconds);

  if (!state.currentPlanet) {
    const center = characterCenter(state.head, state.leftFoot, state.rightFoot);
    const grounds = world.groundsNear(center, boundRadius + settings.maxGravityDistance);
    const leftFootGravity = sumGravity(grounds, state.leftFoot.center);
    const rightFootGravity = sumGravity(grounds, state.rightFoot.center);

    applyForce(state.leftFoot, leftFootGravity, deltaTimeInSeconds);
    applyForce(state.rightFoot, rightFootGravity, deltaTimeInSeconds);

    const sumForce = vec2.subtract(vec2.create(), leftFootGravity, movementForce);
    setDirection(
      state,
      vec2.length(sumForce) === 0 ? vec2.fromValues(0, -1) : sumForce,
      deltaTimeInSeconds,
    );
  } else {
    carryWithRotatingPlanet(state, deltaTimeInSeconds);

    const leftFootGravity = state.currentPlanet.gravityAt(state.leftFoot.center);
    const rightFootGravity = state.currentPlanet.gravityAt(state.rightFoot.center);

    vec2.add(leftFootGravity, leftFootGravity, rightFootGravity);
    const gravity = vec2.scale(leftFootGravity, leftFootGravity, 0.5);

    const movementLength = vec2.length(movementForce);
    const gravityLength = vec2.length(gravity);
    if (
      movementLength > 0 &&
      gravityLength > 0 &&
      vec2.dot(movementForce, gravity) <
        -movementLength * gravityLength * settings.climbDotThreshold
    ) {
      vec2.scale(gravity, gravity, settings.climbGravityScale);
    }

    const scaledLeftFootGravity = vec2.scale(
      vec2.create(),
      state.leftFoot.lastNormal,
      vec2.dot(state.leftFoot.lastNormal, gravity),
    );
    applyForce(state.leftFoot, scaledLeftFootGravity, deltaTimeInSeconds);

    const scaledRightFootGravity = vec2.scale(
      vec2.create(),
      state.rightFoot.lastNormal,
      vec2.dot(state.rightFoot.lastNormal, gravity),
    );
    applyForce(state.rightFoot, scaledRightFootGravity, deltaTimeInSeconds);

    if (vec2.length(gravity) <= settings.planetDetachmentForceThreshold) {
      state.currentPlanet = undefined;
    }
    setDirection(state, gravity, deltaTimeInSeconds);
  }

  keepPosture(state);

  applyBodyMomentum(state);

  latchGround(state, world.stepBody(state.leftFoot, deltaTimeInSeconds));
  latchGround(state, world.stepBody(state.rightFoot, deltaTimeInSeconds));
  world.stepBody(state.head, deltaTimeInSeconds);

  decayMomentum(state.bodyVelocity, !!state.currentPlanet, deltaTimeInSeconds);
};
