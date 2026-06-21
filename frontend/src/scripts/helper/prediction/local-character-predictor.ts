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

// Don't replay more than this far back: if the last acknowledged input is older
// (a stall, or a backgrounded tab catching up) snap to the authoritative pose
// instead of grinding through hundreds of steps.
const maxReplayMs = 300;

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
  private lastAckClientTimeMs?: number;
  // Wall-clock (client) time the latest authoritative snapshot was received. The
  // replay predicts forward from HERE by the snapshot's age, so the local pose
  // advances smoothly with real time between the 25 Hz snapshots. Anchoring to
  // the last *acked input* time instead breaks when input is sent only on change
  // (a held key sends nothing): that time freezes, the window pins to the
  // maxReplayMs clamp, the replay displacement goes constant, and the pose
  // stair-steps at the snapshot rate.
  private authReceiptMs = 0;
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
  ): void {
    // Inputs only advance the acknowledgement forward; the launch momentum and
    // leap boundary always adopt the latest authoritative values.
    if (
      this.lastAckClientTimeMs === undefined ||
      clientTimeMs > this.lastAckClientTimeMs
    ) {
      this.lastAckClientTimeMs = clientTimeMs;
    }
    vec2.set(this.authoritativeBodyVelocity, bodyVelocity[0], bodyVelocity[1]);
    this.lastLeapAckMs = lastLeapClientTimeMs;
  }

  public setAuthoritative(head: Circle, leftFoot: Circle, rightFoot: Circle): void {
    this.authoritative = { head, leftFoot, rightFoot };
    this.authReceiptMs = Math.round(nowMs());
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
    this.lastAckClientTimeMs = undefined;
    this.authReceiptMs = 0;
    vec2.zero(this.authoritativeBodyVelocity);
    this.currentStrength = settings.playerMaxStrength;
    this.carriedPlanetId = undefined;
    this.carriedSecondsSinceSurface = 1;
    this.hasRender = false;
    this.alive = true;
  }

  public get canPredict(): boolean {
    return this.authoritative !== undefined && this.lastAckClientTimeMs !== undefined;
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
    // Predict forward from the latest snapshot by its age, clamped so a stall
    // (or a backgrounded tab catching up) snaps instead of grinding hundreds of
    // steps. This advances with wall-clock time even while a held key sends no
    // fresh input, so the pose no longer pins to the 25 Hz snapshot cadence.
    const startMs = Math.max(this.authReceiptMs, now - maxReplayMs);
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
