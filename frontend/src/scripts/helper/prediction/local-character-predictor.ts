import { vec2 } from 'gl-matrix';
import {
  Circle,
  CharacterMovementState,
  Id,
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

const stepMs = 1000 / 200; // match the server's 200 Hz fixed tick
const stepSeconds = 1 / 200;

// Clock source for the predictor. Injectable so deterministic reconciliation
// tests can drive prediction without real time passing; defaults to the
// browser wall clock in production.
let nowMs: () => number = () => performance.now();
export const setPredictorClockForTesting = (clock: () => number): void => {
  nowMs = clock;
};

// The same clock the predictor stamps input with. Anything that tells the server
// "this is how far my input timeline has got" must read it from here, or the
// acknowledgement comes back in a different time base than the replay window.
export const predictorNowMs = (): number => nowMs();

// Don't replay more than this far back: if the last acknowledged input is older
// (a stall, or a backgrounded tab catching up) fall back to a shorter window
// instead of grinding through hundreds of steps. Comfortably covers the replay
// a 300 ms round trip needs; beyond that the body simply trails a little.
const maxReplayMs = 400;

// Render-side easing of the correction the reconciliation produces each frame,
// so a snapshot that disagrees with the prediction is smoothed out instead of
// popping. Short, so the local player still feels immediate.
const smoothSeconds = 0.06;

// A correction bigger than this isn't prediction error — it's a respawn,
// teleport, or a server-side impulse (leap / slingshot / recoil / death throw)
// the predictor doesn't model. Snap to it rather than gliding across the gap.
const snapDistance = 250;

const makeBody = (center: vec2, radius: number): PhysicsBody => ({
  center: vec2.clone(center),
  radius,
  velocity: vec2.create(),
  lastNormal: vec2.fromValues(0, 1),
  restitution: 0,
});

// Predicts the local player's character so it responds to input immediately,
// instead of lagging ~100 ms + RTT behind like the interpolated remote objects.
// Each frame it resets to the latest authoritative snapshot and replays the
// player's own un-acknowledged input through the SAME movement simulation the
// server runs (shared/stepCharacterMovement), then eases the rendered pose
// toward the result. Discrete server-side impulses it can't model show up as a
// large correction and snap rather than rubber-band.
export class LocalCharacterPredictor {
  private readonly inputHistory = new InputHistory();
  private readonly world = new ClientCharacterWorld();

  private authoritative?: { head: Circle; leftFoot: Circle; rightFoot: Circle };
  // Client-clock instant the authoritative pose below belongs to, less one
  // one-way trip — which is exactly the lead the local body should have, since
  // the input the player is giving right now will not reach the server for that
  // long. Replaying from here reproduces every input the server has not applied
  // yet, so the body responds immediately at any latency.
  //
  // It is built from BOTH halves of the acknowledgement: the client-clock time
  // of the newest input the server had applied, plus how long after that the
  // snapshot was actually taken. Both halves are needed.
  //
  // Anchoring on the acknowledged input time ALONE beats against the send
  // cadence: input is sent once per frame, so at snapshot time the newest input
  // the server holds is 0..1 frame old depending on where the client's frames
  // fell, and that age lands directly in the replay window. Measured on
  // localhost it walked a sawtooth — 17, 10, 6, 1, 11, 6, 2, 12 ms — so the
  // window jumped by up to a frame of travel every snapshot and the body
  // stuttered at 25 Hz. ackAgeMs cancels it exactly.
  //
  // Anchoring on the snapshot's ARRIVAL is free of that beat, but it under-
  // advances by a one-way trip, so the local body trails its own input at any
  // real latency. This anchor degenerates to arrival on a zero-latency link and
  // grows into full compensation as latency rises.
  //
  // A held key sends no fresh movement, which would freeze the acknowledgement
  // altogether; that is fixed at the source, by closing every outgoing batch
  // with a ClientHeartbeatCommand.
  private replayAnchorMs?: number;
  // Authoritative launch momentum at the last snapshot — seeds each replay so a
  // leap/slingshot/recoil flight is reproduced and continuously corrected.
  private authoritativeBodyVelocity = vec2.create();
  // Wall-clock times the player issued a leap, replayed (with the impulse
  // applied locally) so the launch is felt immediately, not after a round trip.
  private leapHistory: Array<number> = [];
  // clientTimeMs of the last leap the server has folded into the streamed
  // momentum. Leaps at or before this are already in authoritativeBodyVelocity;
  // only newer ones are replayed, so a leap is never applied twice.
  private lastLeapAckMs = -Infinity;
  // Latest streamed shooting-strength, to gate predicted leaps as the server does.
  private currentStrength = settings.playerMaxStrength;

  // Whether the local body is alive on the server. While dead (awaiting respawn)
  // prediction is suppressed so the corpse/ghost can't keep walking in response
  // to input — the server ignores a dead player's movement, so a predicted body
  // that still moved would be a pure client-side desync.
  private alive = true;

  // Continuous state carried between replays (the snapshot carries only poses).
  // The facing direction is NOT carried — it is re-derived from the pose each
  // frame (see directionFromPose / simulate); only the latched planet and the
  // time-since-surface persist.
  private carriedPlanetId?: Id;
  private carriedSecondsSinceSurface = 1;

  // The eased, rendered pose handed to the view.
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

  // Stamp a movement command and record it for replay. Returns the wall-clock
  // time the command should carry so the server can echo it back.
  public recordInput(direction: vec2): number {
    const timeMs = Math.round(nowMs());
    this.inputHistory.record(direction, timeMs);
    return timeMs;
  }

  public acknowledge(
    clientTimeMs: number,
    bodyVelocity: vec2,
    lastLeapClientTimeMs: number,
    ackAgeMs = 0,
  ): void {
    // Inputs only advance the acknowledgement forward; the launch momentum and
    // leap boundary always adopt the latest authoritative values.
    const anchor = clientTimeMs + Math.max(0, ackAgeMs);
    if (this.replayAnchorMs === undefined || anchor > this.replayAnchorMs) {
      this.replayAnchorMs = anchor;
    }
    vec2.set(this.authoritativeBodyVelocity, bodyVelocity[0], bodyVelocity[1]);
    this.lastLeapAckMs = lastLeapClientTimeMs;
  }

  public setAuthoritative(head: Circle, leftFoot: Circle, rightFoot: Circle): void {
    this.authoritative = { head, leftFoot, rightFoot };
  }

  // The player pressed leap; remember when, so the replay applies the same
  // impulse the server will. Recorded regardless of whether the server accepts
  // it — a rejected leap (no strength/cooldown) self-corrects via the streamed
  // authoritative momentum.
  public recordLeap(): number {
    const timeMs = Math.round(nowMs());
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
    vec2.zero(this.authoritativeBodyVelocity);
    this.currentStrength = settings.playerMaxStrength;
    this.carriedPlanetId = undefined;
    this.carriedSecondsSinceSurface = 1;
    this.hasRender = false;
    this.alive = true;
  }

  public get canPredict(): boolean {
    return this.authoritative !== undefined && this.replayAnchorMs !== undefined;
  }

  // During spawn-in and death the server freezes walking and only scales the
  // body (CharacterPhysical.step returns early), so its head radius is below
  // nominal. Predicting then would walk the body off a position the server is
  // holding still — let interpolation show the animation instead.
  private get isAnimatingInOrOut(): boolean {
    return (
      this.authoritative !== undefined &&
      this.authoritative.head.radius < headRadius - 0.5
    );
  }

  // Run one frame of prediction. Returns true if it produced a rendered pose the
  // caller should use (otherwise fall back to interpolation). `planets` is the
  // current collision world; `frameSeconds` is the render delta.
  public update(planets: Array<PredictablePlanet>, frameSeconds: number): boolean {
    if (!this.alive || !this.canPredict || this.isAnimatingInOrOut) {
      // Resume from the authoritative pose with a snap rather than gliding from
      // a stale rendered one.
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

  // The body's facing angle is encoded in the pose: each part is sprung toward
  // center + R(direction)*offset and the head's offset points +y, so
  // direction = atan2(head - center) - PI/2. Re-deriving it from the snapshot
  // each frame (rather than carrying the previous frame's evolved value onto
  // this past pose, re-evolved by a variable substep count) keeps the posture
  // seed a pure function of the snapshot — carrying it fed a frame-rate-dependent
  // loop that wobbled the rendered limbs.
  private directionFromPose(head: Circle, leftFoot: Circle, rightFoot: Circle): number {
    const cx = (head.center[0] + leftFoot.center[0] + rightFoot.center[0]) / 3;
    const cy = (head.center[1] + leftFoot.center[1] + rightFoot.center[1]) / 3;
    return Math.atan2(head.center[1] - cy, head.center[0] - cx) - Math.PI / 2;
  }

  private simulate(): CharacterMovementState {
    const auth = this.authoritative!;
    const now = Math.round(nowMs());
    // Replay every input the server has not confirmed yet: from the anchor up to
    // now, clamped so a stall (or a backgrounded tab catching up) cannot grind
    // through hundreds of steps.
    const startMs = Math.min(now, Math.max(this.replayAnchorMs!, now - maxReplayMs));
    const windowMs = Math.max(0, now - startMs);
    const steps = Math.floor(windowMs / stepMs);
    const remainderSeconds = (windowMs - steps * stepMs) / 1000;

    const state: CharacterMovementState = {
      head: makeBody(auth.head.center, auth.head.radius),
      leftFoot: makeBody(auth.leftFoot.center, auth.leftFoot.radius),
      rightFoot: makeBody(auth.rightFoot.center, auth.rightFoot.radius),
      direction: this.directionFromPose(auth.head, auth.leftFoot, auth.rightFoot),
      currentPlanet: this.world.surfaceById(this.carriedPlanetId),
      secondsSinceOnSurface: this.carriedSecondsSinceSurface,
      // Leaps before the replay window are already baked into this; leaps inside
      // the window are re-applied below, so neither is double-counted.
      bodyVelocity: vec2.clone(this.authoritativeBodyVelocity),
    };

    // The planet collision frames were synced (in update(), just before this)
    // to the NEWEST snapshot's rotation — the same instant the authoritative
    // body pose is from — so the body and the surface start the replay at the
    // same phase. The loop below advances the surfaces FORWARD in lockstep with
    // the body's carry from that shared phase, so no rewind is needed (and the
    // persistent surfaces are re-synced next frame, so this never accumulates).

    const cooldownMs = settings.leapCooldownSeconds * 1000;
    // Mirror the server: each accepted leap spends leapStrengthCost, so a burst
    // of leaps in one replay window is gated by the running strength rather than
    // a single up-front affordability check.
    let availableStrength = this.currentStrength;
    let lastLeapMs = -Infinity;

    let t = startMs;
    for (let i = 0; i < steps; i++) {
      const input = this.inputHistory.directionAt(t);
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(state, this.world, input, stepSeconds);
      this.world.advance(stepSeconds);

      // A leap issued during this step launches now (the next step injects the
      // momentum), gated like the server: on a surface, off cooldown, with
      // strength. applyLeapImpulse is a no-op off-surface.
      for (const leapMs of this.leapHistory) {
        if (
          leapMs >= t &&
          leapMs < t + stepMs &&
          // Only leaps the server hasn't yet folded into the seed, so a leap
          // is never both seeded and replayed.
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

    // Final sub-tick of the leftover (< stepMs) so the predicted pose is a
    // continuous function of the window length rather than advancing in 5 ms
    // quanta — the floor() above would otherwise surface that as a per-frame
    // wobble on top of the ~16.7 ms render cadence.
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

    this.carriedPlanetId = this.world.idOf(state.currentPlanet);
    this.carriedSecondsSinceSurface = state.secondsSinceOnSurface;

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
