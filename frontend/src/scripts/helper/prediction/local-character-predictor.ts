import { vec2 } from 'gl-matrix';
import {
  Circle,
  CharacterMovementSnapshot,
  CharacterMovementState,
  PhysicsBody,
  settings,
  stepCharacterMovement,
  applyLeapImpulse,
  tickPlanetDetachment,
  feetRadius,
  headRadius,
} from 'shared';
import { ClientCharacterWorld, PredictablePlanet } from './client-character-world';
import { InputHistory } from './input-history';

// Must match the server's tick source — the replay integrates over this dt.
const stepSeconds = settings.targetPhysicsDeltaTimeInSeconds;
const stepMs = stepSeconds * 1000;

// Frame timestamp, not performance.now() — dispatch jitter would land in the replay window.
let frameTimeMs = 0;
export const setFrameTimeMs = (timeMs: number): void => {
  frameTimeMs = timeMs;
};
export const predictorNowMs = (): number => frameTimeMs;

const maxReplayMs = 400;

const smoothSeconds = 0.06;

const snapDistance = 250;

const upwards = vec2.fromValues(0, 1);

// Velocity starts at zero — the sim rebuilds it each tick, so it is not carried state.
const makeBody = (center: vec2, radius: number, normal: vec2): PhysicsBody => ({
  center: vec2.clone(center),
  radius,
  velocity: vec2.create(),
  lastNormal: vec2.fromValues(normal[0], normal[1]),
  restitution: 0,
});

export class LocalCharacterPredictor {
  private readonly inputHistory = new InputHistory();
  private readonly world = new ClientCharacterWorld();

  private authoritative?: { head: Circle; leftFoot: Circle; rightFoot: Circle };
  // Replay anchor: built from both halves of the ack (input time + ackAge), advances forward only.
  private replayAnchorMs?: number;
  private movement?: CharacterMovementSnapshot;
  private leapHistory: Array<number> = [];
  // Last leap the server folded into streamed momentum; newer ones only, so a leap is never applied twice.
  private lastLeapAckMs = -Infinity;
  private currentStrength = settings.playerMaxStrength;

  // Dead players don't predict — the server ignores their input, so moving would desync.
  private alive = true;

  private renderHead = new Circle(vec2.create(), headRadius);
  private renderLeftFoot = new Circle(vec2.create(), feetRadius);
  private renderRightFoot = new Circle(vec2.create(), feetRadius);
  private hasRender = false;

  public get head(): Circle {
    return this.renderHead;
  }
  public get leftFoot(): Circle {
    return this.renderLeftFoot;
  }
  public get rightFoot(): Circle {
    return this.renderRightFoot;
  }

  public recordInput(direction: vec2): number {
    const timeMs = Math.round(frameTimeMs);
    this.inputHistory.record(direction, timeMs);
    return timeMs;
  }

  public acknowledge(
    clientTimeMs: number,
    movement: CharacterMovementSnapshot,
    lastLeapClientTimeMs: number,
    ackAgeMs = 0,
  ): void {
    // The anchor only advances forward; movement state and leap boundary always adopt the latest authoritative values.
    const anchor = clientTimeMs + Math.max(0, ackAgeMs);
    if (this.replayAnchorMs === undefined || anchor > this.replayAnchorMs) {
      this.replayAnchorMs = anchor;
    }
    this.movement = movement;
    this.lastLeapAckMs = lastLeapClientTimeMs;
  }

  public setAuthoritative(head: Circle, leftFoot: Circle, rightFoot: Circle): void {
    this.authoritative = { head, leftFoot, rightFoot };
  }

  // Recorded regardless of acceptance — a rejected leap self-corrects via streamed momentum.
  public recordLeap(): number {
    const timeMs = Math.round(frameTimeMs);
    this.leapHistory.push(timeMs);
    const cutoff = timeMs - 1500;
    while (this.leapHistory.length > 0 && this.leapHistory[0] <= cutoff) {
      this.leapHistory.shift();
    }
    return timeMs;
  }

  public setStrength(strength: number): void {
    this.currentStrength = strength;
  }

  public setAlive(alive: boolean): void {
    this.alive = alive;
  }

  public reset(): void {
    this.inputHistory.reset();
    this.leapHistory = [];
    this.lastLeapAckMs = -Infinity;
    this.authoritative = undefined;
    this.replayAnchorMs = undefined;
    this.movement = undefined;
    this.currentStrength = settings.playerMaxStrength;
    this.hasRender = false;
    this.alive = true;
  }

  public get canPredict(): boolean {
    return (
      this.authoritative !== undefined &&
      this.movement !== undefined &&
      this.replayAnchorMs !== undefined
    );
  }

  // While spawn-in/death the server freezes walking (head radius < nominal) — don't predict, let interpolation show it.
  private get isAnimatingInOrOut(): boolean {
    return (
      this.authoritative !== undefined &&
      this.authoritative.head.radius < headRadius - 0.5
    );
  }

  public update(planets: Array<PredictablePlanet>, frameSeconds: number): boolean {
    if (!this.alive || !this.canPredict || this.isAnimatingInOrOut) {
      this.hasRender = false;
      return false;
    }

    this.world.sync(planets);
    const predicted = this.simulate();

    if (!this.hasRender) {
      this.snapRenderTo(predicted);
      this.hasRender = true;
    } else {
      this.easeRenderTo(predicted, frameSeconds);
    }
    return true;
  }

  private simulate(): CharacterMovementState {
    const auth = this.authoritative!;
    const movement = this.movement!;
    const now = Math.round(frameTimeMs);
    // Replay unconfirmed input from anchor to now, clamped so a stalled tab can't grind hundreds of steps.
    const startMs = Math.min(now, Math.max(this.replayAnchorMs!, now - maxReplayMs));
    const windowMs = Math.max(0, now - startMs);
    const steps = Math.floor(windowMs / stepMs);
    const remainderSeconds = (windowMs - steps * stepMs) / 1000;

    // Full authoritative state — replay is a pure function of (snapshot, input, window) and cannot drift.
    const state: CharacterMovementState = {
      head: makeBody(auth.head.center, auth.head.radius, upwards),
      leftFoot: makeBody(
        auth.leftFoot.center,
        auth.leftFoot.radius,
        movement.leftFootNormal,
      ),
      rightFoot: makeBody(
        auth.rightFoot.center,
        auth.rightFoot.radius,
        movement.rightFootNormal,
      ),
      direction: movement.direction,
      currentPlanet: this.world.surfaceById(movement.groundPlanetId),
      secondsSinceOnSurface: movement.secondsSinceOnSurface,
      // Leaps before the window are baked in; inside it they're re-applied — neither double-counted.
      bodyVelocity: vec2.fromValues(movement.bodyVelocity[0], movement.bodyVelocity[1]),
    };

    // Planet frames are synced to the newest snapshot's rotation, then advanced forward in lockstep with the body — no rewind needed.

    const cooldownMs = settings.leapCooldownSeconds * 1000;
    // Mirror the server: each accepted leap spends strength, so a burst is gated by running strength.
    let availableStrength = this.currentStrength;
    let lastLeapMs = -Infinity;

    let t = startMs;
    for (let i = 0; i < steps; i++) {
      const input = this.inputHistory.directionAt(t);
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(state, this.world, input, stepSeconds);
      this.world.advance(stepSeconds);

      for (const leapMs of this.leapHistory) {
        if (
          leapMs >= t &&
          leapMs < t + stepMs &&
          // Only leaps the server hasn't seeded — never both seeded and replayed.
          leapMs > this.lastLeapAckMs &&
          state.currentPlanet &&
          leapMs - lastLeapMs >= cooldownMs &&
          availableStrength >= settings.leapStrengthCost
        ) {
          applyLeapImpulse(state, this.inputHistory.directionAt(leapMs));
          availableStrength -= settings.leapStrengthCost;
          lastLeapMs = leapMs;
        }
      }

      t += stepMs;
    }

    // Sub-tick the remainder so the pose is continuous in the window length, not quantized to stepMs.
    if (remainderSeconds > 0) {
      tickPlanetDetachment(state, remainderSeconds);
      stepCharacterMovement(
        state,
        this.world,
        this.inputHistory.directionAt(now),
        remainderSeconds,
      );
      this.world.advance(remainderSeconds);
    }

    return state;
  }

  private snapRenderTo(state: CharacterMovementState): void {
    this.renderHead = new Circle(vec2.clone(state.head.center), state.head.radius);
    this.renderLeftFoot = new Circle(
      vec2.clone(state.leftFoot.center),
      state.leftFoot.radius,
    );
    this.renderRightFoot = new Circle(
      vec2.clone(state.rightFoot.center),
      state.rightFoot.radius,
    );
  }

  private easeRenderTo(state: CharacterMovementState, frameSeconds: number): void {
    const q = 1 - Math.exp(-frameSeconds / smoothSeconds);
    this.easePart(this.renderHead, state.head, q);
    this.easePart(this.renderLeftFoot, state.leftFoot, q);
    this.easePart(this.renderRightFoot, state.rightFoot, q);
  }

  private easePart(render: Circle, target: PhysicsBody, q: number): void {
    if (vec2.distance(render.center, target.center) > snapDistance) {
      vec2.copy(render.center, target.center);
    } else {
      vec2.lerp(render.center, render.center, target.center, q);
    }
    render.radius = target.radius;
  }
}

export const localCharacterPredictor = new LocalCharacterPredictor();
