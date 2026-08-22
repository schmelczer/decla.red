import { vec2 } from 'gl-matrix';

import {
  clamp,
  clamp01,
  id,
  mix,
  Random,
  serializesTo,
  settings,
  PlanetBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CommandExecutors,
  CommandReceiver,
} from 'shared';
import { GeneratePointsCommand } from '../commands/generate-points';
import { AnnounceCommand } from '../commands/announce';
import { StepCommand } from '../commands/step';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { StaticPhysical } from '../physics/physicals/static-physical';
import { LampPhysical } from './lamp-physical';
import type { CharacterPhysical } from './character-physical';

@serializesTo(PlanetBase)
export class PlanetPhysical extends PlanetBase implements StaticPhysical {
  public readonly canCollide = true;
  public readonly canMove = false;
  // Marks this as standable ground for the shared movement simulation (a body
  // landing on it latches it as currentPlanet). See shared GroundSurface.
  public readonly isGround = true;

  public readonly sizePointMultiplier: number;

  // Planets slowly spin. The angle is authoritative here and streamed to the
  // client (see getPropertyUpdates), so the rendered outline and this collision
  // polygon turn as one rigid body. cos/sin are memoised per angle because
  // distance() is called many times per tick by the raymarcher and SDF sampling.
  private rotation = 0;
  private readonly rotationSpeed: number;
  private cachedRotation = Number.NaN;
  private cosRotation = 1;
  private sinRotation = 0;

  private _boundingBox?: ImmutableBoundingBox;

  private readonly lamps: Array<LampPhysical> = [];

  private lastTeam: CharacterTeam = CharacterTeam.neutral;

  // Characters standing on the planet this tick. Filled by registerPresence as
  // each grounded character steps, drained when the planet resolves capture in
  // its own step(). Drives the head-count tug-of-war.
  private presentCharacters: Array<CharacterPhysical> = [];
  private isContested = false;

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.step.bind(this),
  };

  public addLamp(lamp: LampPhysical) {
    this.lamps.push(lamp);
  }

  constructor(vertices: Array<vec2>, isKeystone = false) {
    super(id(), vertices, 0.5, isKeystone);

    const sizeClass = clamp01(
      (this.radius - settings.planetMinReferenceRadius) /
      (settings.planetMaxReferenceRadius - settings.planetMinReferenceRadius),
    );

    this.sizePointMultiplier = mix(1, settings.planetSizePointMultiplierMax, sizeClass);

    this.rotationSpeed =
      (0.05 + Random.getRandom() * 0.07) * (Random.getRandom() < 0.5 ? -1 : 1);
  }

  // A grounded character announces itself each tick so the planet can resolve
  // contested capture from the net head-count.
  public registerPresence(character: CharacterPhysical) {
    this.presentCharacters.push(character);
  }

  public distance(target: vec2): number {
    // Evaluate the SDF in the planet's own rotating frame so this collision
    // outline turns in lockstep with the rendered planet (see planet-shape.ts).
    const local = this.toLocalFrame(target);

    const startEnd = this.vertices[0];
    let vb = startEnd;

    let d = vec2.dist(local, vb);
    let sign = 1;

    for (let i = 1; i <= this.vertices.length; i++) {
      const va = vb;
      vb = i === this.vertices.length ? startEnd : this.vertices[i];
      const targetFromDelta = vec2.subtract(vec2.create(), local, va);
      const toFromDelta = vec2.subtract(vec2.create(), vb, va);
      const h = clamp01(
        vec2.dot(targetFromDelta, toFromDelta) / vec2.squaredLength(toFromDelta),
      );

      const ds = vec2.fromValues(
        vec2.dist(targetFromDelta, vec2.scale(vec2.create(), toFromDelta, h)),
        toFromDelta.x * targetFromDelta.y - toFromDelta.y * targetFromDelta.x,
      );

      if (
        (local.y >= va.y && local.y < vb.y && ds.y > 0) ||
        (local.y < va.y && local.y >= vb.y && ds.y <= 0)
      ) {
        sign *= -1;
      }

      d = Math.min(d, ds.x);
    }

    return sign * d;
  }

  // Rotate a world point by -rotation about the centre, matching the shader's
  // `localTarget = center + R(rotation) * (target - center)` transform exactly.
  private toLocalFrame(target: vec2): vec2 {
    if (this.rotation !== this.cachedRotation) {
      this.cachedRotation = this.rotation;
      this.cosRotation = Math.cos(this.rotation);
      this.sinRotation = Math.sin(this.rotation);
    }

    const dx = target.x - this.center.x;
    const dy = target.y - this.center.y;

    return vec2.fromValues(
      this.center.x + this.cosRotation * dx - this.sinRotation * dy,
      this.center.y + this.sinRotation * dx + this.cosRotation * dy,
    );
  }

  // Signed angular velocity in rad/s, exposed so a character standing on the
  // planet can ride its spin (see carryWithRotatingPlanet in shared).
  public get angularVelocity(): number {
    return this.rotationSpeed;
  }

  public get team(): CharacterTeam {
    return Math.abs(this.ownership - 0.5) < settings.planetControlThreshold
      ? CharacterTeam.neutral
      : this.ownership < 0.5
        ? CharacterTeam.blue
        : CharacterTeam.red;
  }

  private timeSinceLastPointGeneration = 0;
  private getPoints(game: CommandReceiver) {
    if (this.timeSinceLastPointGeneration > settings.planetPointGenerationInterval) {
      this.timeSinceLastPointGeneration = 0;

      const value = Math.round(
        settings.planetPointGenerationValue * this.sizePointMultiplier,
      );
      game.handleCommand(
        new GeneratePointsCommand(
          this.team === CharacterTeam.blue ? value : 0,
          this.team === CharacterTeam.red ? value : 0,
        ),
      );
    }
  }

  private step({ deltaTimeInSeconds, game }: StepCommand) {
    this.rotation += deltaTimeInSeconds * this.rotationSpeed;
    this.timeSinceLastPointGeneration += deltaTimeInSeconds;

    // In reverse order, so that teams can achieve a 100% control.
    this.getPoints(game);
    this.resolveCapture(deltaTimeInSeconds);
    this.detectFlip(game);

    this.presentCharacters = [];
  }

  // One capture step per tick driven by the net team head-count, so grouping up
  // pays off and an equal standoff freezes the planet (contested) instead of
  // both sides silently cancelling with no feedback.
  private resolveCapture(deltaTime: number) {
    let blue = 0;
    let red = 0;
    for (const c of this.presentCharacters) {
      if (c.team === CharacterTeam.blue) {
        blue++;
      } else if (c.team === CharacterTeam.red) {
        red++;
      }
    }
    const net = red - blue;
    const occupied = blue + red > 0;

    if (net !== 0) {
      const lead = Math.min(Math.abs(net), settings.maxContestLeadMultiplier);
      this.takeControl(
        net > 0 ? CharacterTeam.red : CharacterTeam.blue,
        deltaTime * lead,
      );
    } else if (!occupied) {
      // Empty planets drift back to neutral; the keystone drifts much slower so
      // it lingers as a live flashpoint.
      this.takeControl(
        CharacterTeam.neutral,
        this.isKeystone ? deltaTime / settings.keystoneLoseControlScale : deltaTime,
      );
    }
    // occupied tie -> frozen tug-of-war: no ownership change, ring pulses.

    const contested = occupied && net === 0;
    if (contested !== this.isContested) {
      this.isContested = contested;
      this.remoteCall('setContested', contested);
    }
  }

  // hysteresis
  private get flipTeam(): CharacterTeam {
    const control = this.ownership - 0.5;
    const enter = settings.planetControlThreshold + settings.planetFlipHysteresis;

    if (control > enter) {
      return CharacterTeam.red;
    }
    if (control < -enter) {
      return CharacterTeam.blue;
    }
    if (Math.abs(control) < settings.planetControlThreshold) {
      return CharacterTeam.neutral;
    }
    return this.lastTeam;
  }

  private detectFlip(game: CommandReceiver) {
    const currentTeam = this.flipTeam;
    if (currentTeam === this.lastTeam) {
      return;
    }
    this.lastTeam = currentTeam;

    if (currentTeam !== CharacterTeam.neutral) {
      const reward = Math.round(
        settings.captureFlipPointReward * this.sizePointMultiplier,
      );
      this.remoteCall('generatedPoints', reward);
      game.handleCommand(
        new GeneratePointsCommand(
          currentTeam === CharacterTeam.blue ? reward : 0,
          currentTeam === CharacterTeam.red ? reward : 0,
        ),
      );

      if (this.isKeystone) {
        game.handleCommand(
          new AnnounceCommand(
            `Team <span class="${currentTeam}">${currentTeam}</span> captured the Heart`,
          ),
        );
      }
    }

    const control = Math.abs(this.ownership - 0.5) / 0.5;
    const lightness = mix(settings.lampMinLightness, settings.lampMaxLightness, control);
    const color = settings.palette[settings.colorIndices[currentTeam]];

    this.lamps.forEach((lamp) => lamp.queueSetLight(color, lightness));

    this.remoteCall('onFlipped', currentTeam);
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('ownership', this.ownership, 0),
      // Stream the spin rate as the rate-of-change so the client can keep the
      // angle moving when snapshots run late (see planet-view.ts).
      new UpdatePropertyCommand('rotation', this.rotation, this.rotationSpeed),
    ]);
  }

  public takeControl(team: CharacterTeam, deltaTime: number) {
    if (team === CharacterTeam.blue) {
      this.ownership -= (0.5 / settings.takeControlTimeInSeconds) * deltaTime;
    } else if (team === CharacterTeam.red) {
      this.ownership += (0.5 / settings.takeControlTimeInSeconds) * deltaTime;
    } else {
      const previous = this.ownership;
      this.ownership +=
        -Math.sign(this.ownership - 0.5) *
        (0.5 / settings.loseControlTimeInSeconds) *
        deltaTime;
      if (
        (previous < 0.5 && this.ownership > 0.5) ||
        (previous > 0.5 && this.ownership < 0.5)
      ) {
        this.ownership = 0.5;
      }
    }

    this.ownership = clamp01(this.ownership);
  }

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      // The polygon spins about its centre (see distance), so this static box
      // has to cover every orientation, not just the spawn-time one: take the
      // circumscribed circle around the rotation centre.
      const maxVertexDistance = this.vertices.reduce(
        (max, vertex) => Math.max(max, vec2.distance(this.center, vertex)),
        0,
      );

      this._boundingBox = new ImmutableBoundingBox(
        this.center.x - maxVertexDistance,
        this.center.x + maxVertexDistance,
        this.center.y - maxVertexDistance,
        this.center.y + maxVertexDistance,
      );
    }

    return this._boundingBox;
  }

  public getForce(position: vec2): vec2 {
    const diff = vec2.subtract(vec2.create(), this.center, position);
    const dist = Math.max(settings.minGravityDistance, vec2.length(diff) - this.radius);
    vec2.normalize(diff, diff);
    const scale = clamp(
      settings.maxGravityQ * ((settings.maxGravityDistance / dist) ** 1.5 - 1),
      0,
      settings.maxGravityStrength,
    );
    return vec2.scale(diff, diff, scale);
  }

  // GroundSurface alias the shared movement simulation calls for gravity.
  public gravityAt(position: vec2): vec2 {
    return this.getForce(position);
  }

  public get gameObject(): this {
    return this;
  }
}
