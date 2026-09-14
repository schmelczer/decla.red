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
import { ClientCharacterWorld, PlanetSnapshot } from './client-character-world';
import type { PlanetView } from '../../objects/types/planet-view';
import { InputHistory } from './input-history';

const stepSeconds = settings.targetPhysicsDeltaTimeInSeconds;
const stepMs = stepSeconds * 1000;

let frameTimeMs = 0;
export const setFrameTimeMs = (timeMs: number): void => {
  frameTimeMs = timeMs;
};
export const clientTimeMs = (): number => frameTimeMs;

const maxReplayMs = 400;
const correctionSeconds = 0.08;
const snapDistance = 1500;

interface ReplaySnapshot {
  pose: { head: Circle; leftFoot: Circle; rightFoot: Circle };
  movement: CharacterMovementSnapshot;
  anchorMs: number;
  leapAckMs: number;
  strength: number;
  planets: Array<PlanetSnapshot>;
  horizonState?: CharacterMovementState;
}

const upwards = vec2.fromValues(0, 1);

const makeBody = (center: vec2, radius: number, normal: vec2): PhysicsBody => ({
  center: vec2.clone(center),
  radius,
  velocity: vec2.create(),
  lastNormal: vec2.clone(normal),
  restitution: 0,
});

export class LocalCharacterPredictor {
  public enabled = true;
  private readonly inputHistory = new InputHistory();
  private readonly world = new ClientCharacterWorld();

  private authoritative?: { head: Circle; leftFoot: Circle; rightFoot: Circle };
  private replayAnchorMs?: number;
  private movement?: CharacterMovementSnapshot;
  private leapHistory: Array<number> = [];
  private lastLeapAckMs = -Infinity;
  private currentStrength = settings.playerMaxStrength;

  private alive = true;
  private previousSnapshot?: ReplaySnapshot;
  private lastUpdateMs?: number;
  private readonly correction = vec2.create();

  private renderHead = new Circle(vec2.create(), headRadius);
  private renderLeftFoot = new Circle(vec2.create(), feetRadius);
  private renderRightFoot = new Circle(vec2.create(), feetRadius);

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
    this.replayAnchorMs = clientTimeMs + Math.max(0, ackAgeMs);
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
    this.alive = true;
    this.previousSnapshot = undefined;
    this.lastUpdateMs = undefined;
    vec2.zero(this.correction);
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

  public update(planets: Array<PlanetView>): boolean {
    if (!this.enabled || !this.alive || !this.canPredict || this.isAnimatingInOrOut) {
      this.previousSnapshot = undefined;
      this.lastUpdateMs = undefined;
      vec2.zero(this.correction);
      return false;
    }

    const now = clientTimeMs();
    const deltaSeconds =
      this.lastUpdateMs === undefined ? 0 : (now - this.lastUpdateMs) / 1000;
    vec2.scale(
      this.correction,
      this.correction,
      Math.exp(-deltaSeconds / correctionSeconds),
    );
    const snapshot: ReplaySnapshot =
      this.previousSnapshot && this.previousSnapshot.pose === this.authoritative
        ? this.previousSnapshot
        : {
            pose: this.authoritative!,
            movement: this.movement!,
            anchorMs: this.replayAnchorMs!,
            leapAckMs: this.lastLeapAckMs,
            strength: this.currentStrength,
            planets: planets.map(
              ({ id, vertices, snapshotRotation, snapshotRotationSpeed }) => ({
                id,
                vertices,
                snapshotRotation,
                snapshotRotationSpeed,
              }),
            ),
          };
    const predicted = this.simulate(snapshot);

    if (this.previousSnapshot && this.previousSnapshot.pose !== snapshot.pose) {
      // Compare both snapshots at the same instant: smooth only the correction,
      // leaving fresh input and ordinary movement immediate.
      const previous = this.simulate(this.previousSnapshot);
      vec2.add(
        this.correction,
        this.correction,
        vec2.subtract(vec2.create(), previous.head.center, predicted.head.center),
      );
      if (vec2.length(this.correction) > snapDistance) {
        vec2.zero(this.correction);
      }
    }
    for (const [render, body] of [
      [this.renderHead, predicted.head],
      [this.renderLeftFoot, predicted.leftFoot],
      [this.renderRightFoot, predicted.rightFoot],
    ]) {
      vec2.add(render.center, body.center, this.correction);
      render.radius = body.radius;
    }
    this.previousSnapshot = snapshot;
    this.lastUpdateMs = now;

    return true;
  }

  private simulate(snapshot: ReplaySnapshot): CharacterMovementState {
    if (snapshot.horizonState) {
      return snapshot.horizonState;
    }
    this.world.sync(snapshot.planets);
    const { pose: auth, movement } = snapshot;
    const now = clientTimeMs();
    const startMs = snapshot.anchorMs;
    const windowMs = Math.min(maxReplayMs, Math.max(0, now - startMs));
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

    let availableStrength = snapshot.strength;
    let cooldown = movement.leapCooldownRemaining ?? 0;

    let t = startMs;
    for (let i = 0; i < steps + (partialStep > 0 ? 1 : 0); i++) {
      const fraction = i < steps ? 1 : partialStep;
      const from =
        fraction < 1
          ? [state.head, state.leftFoot, state.rightFoot].map((body) =>
              vec2.clone(body.center),
            )
          : undefined;
      for (const leapMs of this.leapHistory) {
        if (
          leapMs >= t &&
          leapMs < t + stepMs * fraction &&
          leapMs > snapshot.leapAckMs &&
          state.currentPlanet &&
          cooldown <= 0 &&
          availableStrength >= settings.leapStrengthCost
        ) {
          applyLeapImpulse(state, this.inputHistory.directionAt(leapMs));
          availableStrength -= settings.leapStrengthCost;
          cooldown = settings.leapCooldownSeconds;
        }
      }
      this.world.advance(stepSeconds);
      tickPlanetDetachment(state, stepSeconds);
      stepCharacterMovement(
        state,
        this.world,
        this.inputHistory.directionAt(t),
        stepSeconds,
      );
      cooldown = Math.max(0, cooldown - stepSeconds);
      availableStrength = Math.min(
        settings.playerMaxStrength,
        availableStrength + settings.playerStrengthRegenerationPerSeconds * stepSeconds,
      );
      if (from) {
        [state.head, state.leftFoot, state.rightFoot].forEach((body, index) =>
          vec2.lerp(body.center, from[index], body.center, fraction),
        );
      }
      t += stepMs;
    }

    if (windowMs === maxReplayMs) {
      snapshot.horizonState = state;
    }
    return state;
  }
}

export const localCharacterPredictor = new LocalCharacterPredictor();
