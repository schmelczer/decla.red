import { vec2 } from 'gl-matrix';

import {
  clamp,
  clamp01,
  id,
  rotate90Deg,
  rotateMinus90Deg,
  serializesTo,
  settings,
  PlanetBase,
  CharacterTeam,
} from 'shared';

import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { StaticPhysical } from '../physics/physicals/static-physical';
import { GeneratesPoints } from './generates-points';

@serializesTo(PlanetBase)
export class PlanetPhysical
  extends PlanetBase
  implements StaticPhysical, GeneratesPoints {
  public readonly canCollide = true;
  public readonly canMove = false;

  public static neutralPlanetCount = 0;
  public static declaPlanetCount = 0;
  public static redPlanetCount = 0;

  private _boundingBox?: ImmutableBoundingBox;

  constructor(vertices: Array<vec2>) {
    super(id(), vertices);
    PlanetPhysical.neutralPlanetCount++;
  }

  public distance(target: vec2): number {
    const startEnd = this.vertices[0];
    let vb = startEnd;

    let d = vec2.squaredDistance(target, vb);
    let sign = 1;

    for (let i = 1; i <= this.vertices.length; i++) {
      const va = vb;
      vb = i === this.vertices.length ? startEnd : this.vertices[i];
      const targetFromDelta = vec2.subtract(vec2.create(), target, va);
      const toFromDelta = vec2.subtract(vec2.create(), vb, va);
      const h = clamp01(
        vec2.dot(targetFromDelta, toFromDelta) / vec2.squaredLength(toFromDelta),
      );

      const ds = vec2.fromValues(
        vec2.dist(targetFromDelta, vec2.scale(vec2.create(), toFromDelta, h)),
        toFromDelta.x * targetFromDelta.y - toFromDelta.y * targetFromDelta.x,
      );

      if (
        (target.y >= va.y && target.y < vb.y && ds.y > 0) ||
        (target.y < va.y && target.y >= vb.y && ds.y <= 0)
      ) {
        sign *= -1;
      }

      d = Math.min(d, ds.x);
    }

    return sign * d;
  }

  public get team(): CharacterTeam {
    return Math.abs(this.ownership - 0.5) < 0.1
      ? CharacterTeam.neutral
      : this.ownership < 0.5
      ? CharacterTeam.decla
      : CharacterTeam.red;
  }

  private timeSinceLastPointGeneration = 0;
  public getPoints(): {
    decla: number;
    red: number;
  } {
    if (this.timeSinceLastPointGeneration > settings.planetPointGenerationInterval) {
      this.timeSinceLastPointGeneration = 0;
      if (this.team !== CharacterTeam.neutral) {
        this.remoteCall('generatedPoints', settings.planetPointGenerationValue);
      }

      return {
        decla:
          this.team === CharacterTeam.decla ? settings.planetPointGenerationValue : 0,
        red: this.team === CharacterTeam.red ? settings.planetPointGenerationValue : 0,
      };
    }

    return {
      decla: 0,
      red: 0,
    };
  }

  public step(deltaTime: number): void {
    this.timeSinceLastPointGeneration += deltaTime;

    // In reverse order, so that teams can achieve a 100% control.
    this.remoteCall('setOwnership', this.ownership);
    this.takeControl(CharacterTeam.neutral, deltaTime);
  }

  public takeControl(team: CharacterTeam, deltaTime: number) {
    if (team === CharacterTeam.decla) {
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
      const { xMin, xMax, yMin, yMax } = this.vertices.reduce(
        (extremities, vertex) => ({
          xMin: Math.min(extremities.xMin, vertex.x),
          xMax: Math.max(extremities.xMax, vertex.x),
          yMin: Math.min(extremities.yMin, vertex.y),
          yMax: Math.max(extremities.yMax, vertex.y),
        }),
        {
          xMin: Infinity,
          xMax: -Infinity,
          yMin: Infinity,
          yMax: -Infinity,
        },
      );

      this._boundingBox = new ImmutableBoundingBox(xMin, xMax, yMin, yMax);
    }

    return this._boundingBox;
  }

  public getForce(position: vec2): vec2 {
    const diff = vec2.subtract(vec2.create(), this.center, position);
    const dist = Math.max(0, vec2.length(diff) - 600);
    vec2.normalize(diff, diff);
    const scale = clamp(
      settings.maxGravityQ * ((settings.maxGravityDistance / dist) ** 1.5 - 1),
      0,
      settings.maxGravityStrength,
    );
    return vec2.scale(diff, diff, scale);
  }

  public get gameObject(): this {
    return this;
  }
}
