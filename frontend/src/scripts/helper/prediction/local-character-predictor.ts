import { vec2 } from 'gl-matrix';
import {
  Circle,
  CharacterMovementSnapshot,
  CharacterMovementState,
  PhysicsBody,
  settings,
  clamp,
  easeVec2,
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
export const clientTimeMs = (): number => Math.round(frameTimeMs);

const maxReplayMs = 400;

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
      this.easeRenderTo(predicted, frameSeconds);
    }
    return true;
  }

  private simulate(): CharacterMovementState {
    const auth = this.authoritative!;
    const movement = this.movement!;
    const now = clientTimeMs();
    const startMs = clamp(this.replayAnchorMs!, now - maxReplayMs, now);
    const windowMs = Math.max(0, now - startMs);
    const steps = Math.floor(windowMs / stepMs);
    const remainderSeconds = (windowMs - steps * stepMs) / 1000;

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
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(state, this.world, input, stepSeconds);
      this.world.advance(stepSeconds);

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
    this.easePart(this.renderHead, state.head, frameSeconds);
    this.easePart(this.renderLeftFoot, state.leftFoot, frameSeconds);
    this.easePart(this.renderRightFoot, state.rightFoot, frameSeconds);
  }

  private easePart(render: Circle, target: PhysicsBody, frameSeconds: number): void {
    easeVec2(render.center, target.center, frameSeconds, smoothSeconds, snapDistance);
    render.radius = target.radius;
  }
}

export const localCharacterPredictor = new LocalCharacterPredictor();
