import { vec2 } from 'gl-matrix';
import {
  Circle,
  CharacterMovementSnapshot,
  CharacterMovementState,
  PhysicsBody,
  settings,
  followVec2,
  stepCharacterMovement,
  applyLeapImpulse,
  tickPlanetDetachment,
  feetRadius,
  headRadius,
} from 'shared';
import { ClientCharacterWorld } from './client-character-world';
import { PlanetView } from '../../objects/types/planet-view';
import { InputHistory } from './input-history';

const stepSeconds = settings.targetPhysicsDeltaTimeInSeconds;
const stepMs = stepSeconds * 1000;

let frameTimeMs = 0;
export const setFrameTimeMs = (timeMs: number): void => {
  frameTimeMs = timeMs;
};
export const clientTimeMs = (): number => frameTimeMs;

const maxReplayMs = 400;

// Only a correction has to fade; the character's own motion is carried straight through, so this
// buys smoothing without costing responsiveness.
const smoothSeconds = 0.06;

const snapDistance = 250;

const upwards = vec2.fromValues(0, 1);

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
  private replayAnchorMs?: number;
  private movement?: CharacterMovementSnapshot;
  private leapHistory: Array<number> = [];
  private lastLeapAckMs = -Infinity;
  private currentStrength = settings.playerMaxStrength;

  private alive = true;

  private renderHead = new Circle(vec2.create(), headRadius);
  private renderLeftFoot = new Circle(vec2.create(), feetRadius);
  private renderRightFoot = new Circle(vec2.create(), feetRadius);
  private previousTargets = [vec2.create(), vec2.create(), vec2.create()];
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
    const timeMs = clientTimeMs();
    this.inputHistory.record(direction, timeMs);
    return timeMs;
  }

  public acknowledge(
    clientTimeMs: number,
    movement: CharacterMovementSnapshot,
    lastLeapClientTimeMs: number,
    ackAgeMs = 0,
  ): void {
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

  public recordLeap(): number {
    const timeMs = clientTimeMs();
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

  private get isAnimatingInOrOut(): boolean {
    return (
      this.authoritative !== undefined &&
      this.authoritative.head.radius < headRadius - 0.5
    );
  }

  public update(planets: Array<PlanetView>, frameSeconds: number): boolean {
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
      this.followRenderTo(predicted, frameSeconds);
    }
    return true;
  }

  private simulate(): CharacterMovementState {
    const auth = this.authoritative!;
    const movement = this.movement!;
    const now = clientTimeMs();
    const startMs = Math.max(this.replayAnchorMs!, now - maxReplayMs);
    const windowMs = Math.max(0, now - startMs);
    const steps = Math.floor(windowMs / stepMs);
    const partialStep = (windowMs - steps * stepMs) / stepMs;

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
      bodyVelocity: vec2.fromValues(movement.bodyVelocity[0], movement.bodyVelocity[1]),
    };

    const cooldownMs = settings.leapCooldownSeconds * 1000;
    let availableStrength = this.currentStrength;
    let lastLeapMs = -Infinity;

    let t = startMs;
    for (let i = 0; i < steps; i++) {
      const input = this.inputHistory.directionAt(t);
      // Planets first: the server's container holds them ahead of every character.
      this.world.advance(stepSeconds);
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(state, this.world, input, stepSeconds);

      for (const leapMs of this.leapHistory) {
        if (
          leapMs >= t &&
          leapMs < t + stepMs &&
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

    // A shorter final step would not integrate like the server's fixed one, so take a whole
    // step and read the pose part-way along it instead.
    if (partialStep > 0) {
      const from = [state.head, state.leftFoot, state.rightFoot].map((b) =>
        vec2.clone(b.center),
      );
      this.world.advance(stepSeconds);
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(
        state,
        this.world,
        this.inputHistory.directionAt(t),
        stepSeconds,
      );
      [state.head, state.leftFoot, state.rightFoot].forEach((body, i) =>
        vec2.lerp(body.center, from[i], body.center, partialStep),
      );
    }

    return state;
  }

  private snapRenderTo(state: CharacterMovementState): void {
    this.previousTargets = [state.head, state.leftFoot, state.rightFoot].map((b) =>
      vec2.clone(b.center),
    );
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

  private followRenderTo(state: CharacterMovementState, frameSeconds: number): void {
    this.followPart(this.renderHead, state.head, 0, frameSeconds);
    this.followPart(this.renderLeftFoot, state.leftFoot, 1, frameSeconds);
    this.followPart(this.renderRightFoot, state.rightFoot, 2, frameSeconds);
  }

  private followPart(
    render: Circle,
    target: PhysicsBody,
    index: number,
    frameSeconds: number,
  ): void {
    followVec2(
      render.center,
      target.center,
      this.previousTargets[index],
      frameSeconds,
      smoothSeconds,
      snapDistance,
    );
    render.radius = target.radius;
  }
}

export const localCharacterPredictor = new LocalCharacterPredictor();
