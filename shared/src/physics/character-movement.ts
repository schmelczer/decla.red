import { vec2 } from 'gl-matrix';
import { settings } from '../settings';
import { GroundSurface, PhysicsBody } from './sdf';
import { interpolateAngles } from './interpolate-angles';

// Body layout, copied verbatim from CharacterPhysical so the predicted body
// matches the authoritative one to the bit. The head sits this far above the
// feet; offsets are measured from the centre of mass.
export const headRadius = 50;
export const feetRadius = 20;

const desiredHeadOffset = vec2.fromValues(0, 55);
const desiredLeftFootOffset = vec2.fromValues(-20, 0);
const desiredRightFootOffset = vec2.fromValues(20, 0);
const centerOfMass = vec2.scale(
  vec2.create(),
  vec2.add(
    vec2.create(),
    vec2.add(vec2.create(), desiredHeadOffset, desiredLeftFootOffset),
    desiredRightFootOffset,
  ),
  1 / 3,
);
export const headOffset = vec2.subtract(vec2.create(), desiredHeadOffset, centerOfMass);
export const leftFootOffset = vec2.subtract(
  vec2.create(),
  desiredLeftFootOffset,
  centerOfMass,
);
export const rightFootOffset = vec2.subtract(
  vec2.create(),
  desiredRightFootOffset,
  centerOfMass,
);
export const boundRadius = (headRadius + feetRadius * 2) * 2;

// The character's movement state: the three body parts plus the small amount of
// carried state the step reads and writes. Backend CharacterPhysical and the
// client predictor both expose this shape.
export interface CharacterMovementState {
  readonly head: PhysicsBody;
  readonly leftFoot: PhysicsBody;
  readonly rightFoot: PhysicsBody;
  direction: number;
  currentPlanet: GroundSurface | undefined;
  secondsSinceOnSurface: number;
  // Persistent launch momentum (leap / slingshot / recoil / death throw).
  // Walking rebuilds and zeroes each body part's velocity every tick,
  // so anything that should carry accumulates here, is injected into the parts
  // before they step, and decays by friction. Stays zero for ordinary walking.
  // The client predictor leaves this zero and relies on the reconciliation snap
  // to follow server-side impulses, but the field is here so the server can
  // delegate its full movement to stepCharacterMovement unchanged.
  bodyVelocity: vec2;
}

// The collision/gravity world the movement queries. The server backs this with
// its spatial container (planets + dynamics, dispatching collision reactions);
// the client backs it with the planets it knows about, dispatching nothing.
export interface CharacterWorld {
  // Planets within `radius` of `center` that exert gravity / can be stood on.
  groundsNear(center: vec2, radius: number): Array<GroundSurface>;
  // Resolve one body part's motion this tick; returns the ground it landed on.
  stepBody(body: PhysicsBody, deltaTimeInSeconds: number): GroundSurface | undefined;
}

const applyForce = (body: PhysicsBody, force: vec2, deltaTimeInSeconds: number) => {
  vec2.add(
    body.velocity,
    body.velocity,
    vec2.scale(vec2.create(), force, deltaTimeInSeconds),
  );
};

// ((head + leftFoot) + rightFoot) / 3, in the exact association the server uses
// everywhere it reads the character centre — do not reassociate.
export const characterCenter = (state: CharacterMovementState): vec2 => {
  const center = vec2.add(vec2.create(), state.head.center, state.leftFoot.center);
  vec2.add(center, center, state.rightFoot.center);
  return vec2.scale(center, center, 1 / 3);
};

const setDirection = (state: CharacterMovementState, direction: vec2) => {
  state.direction = interpolateAngles(
    state.direction,
    Math.atan2(direction[1], direction[0]) + Math.PI / 2,
    0.2,
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
  // First-order velocity relaxation toward the desired posture position, added
  // to the gravity/movement velocity already accumulated this tick. The dt
  // arrives later when the body integrates velocity, so the per-tick
  // displacement is positionDelta * stiffness * dt.
  vec2.scaleAndAdd(body.velocity, body.velocity, positionDelta, stiffness);
};

const keepPosture = (state: CharacterMovementState) => {
  const center = characterCenter(state);
  springMove(state, state.leftFoot, center, leftFootOffset, settings.postureFeetStiffness);
  springMove(
    state,
    state.rightFoot,
    center,
    rightFootOffset,
    settings.postureFeetStiffness,
  );
  springMove(state, state.head, center, headOffset, settings.postureHeadStiffness);
};

// While standing on a planet, ride its spin: rigidly rotate the whole body
// about the planet centre by the same per-tick angle the collision SDF turns
// by (negative, matching R(-rotation)), so the player is carried with the
// surface instead of sliding across it.
const carryWithRotatingPlanet = (
  state: CharacterMovementState,
  deltaTimeInSeconds: number,
) => {
  const planet = state.currentPlanet;
  if (!planet) {
    return;
  }
  const angle = -planet.angularVelocity * deltaTimeInSeconds;
  const center = planet.center;
  state.head.center = vec2.rotate(vec2.create(), state.head.center, center, angle);
  state.leftFoot.center = vec2.rotate(vec2.create(), state.leftFoot.center, center, angle);
  state.rightFoot.center = vec2.rotate(
    vec2.create(),
    state.rightFoot.center,
    center,
    angle,
  );
};

// Launch off the current surface: directed by the foot contact normals plus
// the movement input, slingshotted by the planet's spin. Mutates bodyVelocity
// (which the next tick injects into the body) and detaches. Shared so the
// server's leap() and the client's prediction apply the exact same impulse.
// The caller does the gating (strength, cooldown, alive); this is a no-op when
// not on a surface.
export const applyLeapImpulse = (
  state: CharacterMovementState,
  moveDirection: vec2,
) => {
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

  // Slingshot: add the tangential velocity of the spinning surface under the
  // body (the same motion carryWithRotatingPlanet imparts).
  const center = characterCenter(state);
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

// Time-based detachment: a grounded body that hasn't touched a surface for a
// while floats free. Kept as its own step because on the server it runs before
// the ownership/scoring blocks; the client calls it at the head of each tick.
export const tickPlanetDetachment = (
  state: CharacterMovementState,
  deltaTimeInSeconds: number,
) => {
  if ((state.secondsSinceOnSurface += deltaTimeInSeconds) > settings.planetDetachmentSeconds) {
    state.currentPlanet = undefined;
  }
};

// Inject the persistent launch momentum onto every body part right before they
// step, so the whole body translates rigidly without disturbing the posture
// springs (which only set up relative offsets). No-op while walking.
const applyBodyMomentum = (state: CharacterMovementState) => {
  if (vec2.squaredLength(state.bodyVelocity) === 0) {
    return;
  }
  vec2.add(state.leftFoot.velocity, state.leftFoot.velocity, state.bodyVelocity);
  vec2.add(state.rightFoot.velocity, state.rightFoot.velocity, state.bodyVelocity);
  vec2.add(state.head.velocity, state.head.velocity, state.bodyVelocity);
};

// Decay one launch-momentum vector in place by one tick. Stiff on the ground
// (skid to a stop), gentle in the air so a leap or slingshot still carries
// across the gaps. The gentle exponential only asymptotes, though, so on top of
// it a constant deceleration brakes the momentum to a definite stop in a couple
// of seconds instead of leaving a 15+ second drift, and a hard cap stops stacked
// impulses (rapid recoil, a leap into a slingshot) from building without bound.
// Shared so the living body, the client predictor, and the ragdoll corpse all
// brake identically.
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

const decayBodyMomentum = (
  state: CharacterMovementState,
  deltaTimeInSeconds: number,
) => {
  decayMomentum(state.bodyVelocity, !!state.currentPlanet, deltaTimeInSeconds);
};

const sumGravity = (grounds: Array<GroundSurface>, position: vec2): vec2 =>
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

// One tick of character movement. This is the exact movement block of the
// authoritative CharacterPhysical.step (gravity gather → movement force →
// on/off-planet branch → posture → step the three body parts), with all
// server-only concerns (scoring, health, shooting, spawn/death animation,
// ownership) left to the caller. `inputDirection` is the already-averaged,
// already-normalized movement direction for this tick and is consumed in place.
export const stepCharacterMovement = (
  state: CharacterMovementState,
  world: CharacterWorld,
  inputDirection: vec2,
  deltaTimeInSeconds: number,
) => {
  const center = characterCenter(state);
  const grounds = world.groundsNear(center, boundRadius + settings.maxGravityDistance);

  const movementForce = vec2.scale(inputDirection, inputDirection, settings.maxAcceleration);
  applyForce(state.leftFoot, movementForce, deltaTimeInSeconds);
  applyForce(state.rightFoot, movementForce, deltaTimeInSeconds);

  if (!state.currentPlanet) {
    const leftFootGravity = sumGravity(grounds, state.leftFoot.center);
    const rightFootGravity = sumGravity(grounds, state.rightFoot.center);

    applyForce(state.leftFoot, leftFootGravity, deltaTimeInSeconds);
    applyForce(state.rightFoot, rightFootGravity, deltaTimeInSeconds);

    const sumForce = vec2.subtract(vec2.create(), leftFootGravity, movementForce);
    setDirection(state, vec2.length(sumForce) === 0 ? vec2.fromValues(0, -1) : sumForce);
  } else {
    carryWithRotatingPlanet(state, deltaTimeInSeconds);

    const leftFootGravity = state.currentPlanet.gravityAt(state.leftFoot.center);
    const rightFootGravity = state.currentPlanet.gravityAt(state.rightFoot.center);

    vec2.add(leftFootGravity, leftFootGravity, rightFootGravity);
    const gravity = vec2.scale(leftFootGravity, leftFootGravity, 0.5);

    if (
      vec2.dot(movementForce, gravity) <
      -vec2.length(movementForce) * settings.climbDotThreshold
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
    setDirection(state, gravity);
  }

  keepPosture(state);

  applyBodyMomentum(state);

  latchGround(state, world.stepBody(state.leftFoot, deltaTimeInSeconds));
  latchGround(state, world.stepBody(state.rightFoot, deltaTimeInSeconds));
  latchGround(state, world.stepBody(state.head, deltaTimeInSeconds));

  decayBodyMomentum(state, deltaTimeInSeconds);
};
