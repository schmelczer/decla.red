import { vec2 } from 'gl-matrix';
import {
  CharacterWorld,
  GroundSurface,
  Id,
  PhysicsBody,
  planetDistance,
  planetGravity,
  resolveCircleMovement,
} from 'shared';

// What the predictor needs to know about a planet to collide and be pulled by
// it. The client reads this off its PlanetViews.
export interface PredictablePlanet {
  id: Id;
  vertices: Array<vec2>;
  center: vec2;
  radius: number;
  rotation: number;
  rotationSpeed: number;
}

// A planet collision/gravity surface whose rotation can be advanced during
// replay, so its outline turns in lockstep with the body the carry term moves —
// exactly as the server steps the planet before the character each tick.
class PlanetSurface implements GroundSurface {
  public readonly canCollide = true;
  public readonly isGround = true;
  public readonly id: Id;
  public center: vec2;
  public angularVelocity: number;
  private vertices: Array<vec2>;
  private radius: number;
  private rotation = 0;
  private cos = 1;
  private sin = 0;

  constructor(planet: PredictablePlanet) {
    this.id = planet.id;
    this.center = planet.center;
    this.vertices = planet.vertices;
    this.radius = planet.radius;
    this.angularVelocity = planet.rotationSpeed;
    this.setRotation(planet.rotation);
  }

  public sync(planet: PredictablePlanet) {
    this.center = planet.center;
    this.vertices = planet.vertices;
    this.radius = planet.radius;
    this.angularVelocity = planet.rotationSpeed;
    this.setRotation(planet.rotation);
  }

  private setRotation(rotation: number) {
    this.rotation = rotation;
    this.cos = Math.cos(rotation);
    this.sin = Math.sin(rotation);
  }

  public advance(deltaTimeInSeconds: number) {
    this.setRotation(this.rotation + this.angularVelocity * deltaTimeInSeconds);
  }

  public distance(target: vec2): number {
    return planetDistance(target, this.vertices, this.center, this.cos, this.sin);
  }

  public gravityAt(target: vec2): vec2 {
    return planetGravity(this.center, this.radius, target);
  }
}

// The planets-only collision world the local predictor runs against. It holds
// persistent surfaces keyed by planet id (so a `currentPlanet` reference stays
// valid across frames) and never dispatches collision reactions — damage,
// scoring and the like are server-authoritative.
export class ClientCharacterWorld implements CharacterWorld {
  private surfaces = new Map<Id, PlanetSurface>();
  private ordered: Array<PlanetSurface> = [];

  // Refresh from the current PlanetViews. Far planets contribute zero gravity
  // (the falloff clamps to 0 past maxGravityDistance) and never collide, so the
  // whole set can be handed to every query without a range filter. Ordered by
  // id so the (rare) two-surface contact picks a stable surface.
  public sync(planets: Array<PredictablePlanet>) {
    const seen = new Set<Id>();
    for (const planet of planets) {
      seen.add(planet.id);
      const existing = this.surfaces.get(planet.id);
      if (existing) {
        existing.sync(planet);
      } else {
        this.surfaces.set(planet.id, new PlanetSurface(planet));
      }
    }
    for (const id of [...this.surfaces.keys()]) {
      if (!seen.has(id)) {
        this.surfaces.delete(id);
      }
    }
    this.ordered = [...this.surfaces.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map((e) => e[1]);
  }

  // Advance every planet's collision frame by one replay substep, so surfaces
  // and the carried body rotate together. The surfaces are re-synced to the
  // newest snapshot rotation each frame (see sync), so the replay only ever
  // steps forward from there.
  public advance(deltaTimeInSeconds: number) {
    for (const surface of this.ordered) {
      surface.advance(deltaTimeInSeconds);
    }
  }

  public surfaceById(id: Id | undefined): GroundSurface | undefined {
    return id == null ? undefined : this.surfaces.get(id);
  }

  public idOf(surface: GroundSurface | undefined): Id | undefined {
    return surface instanceof PlanetSurface ? surface.id : undefined;
  }

  public groundsNear(): Array<GroundSurface> {
    return this.ordered;
  }

  public stepBody(
    body: PhysicsBody,
    deltaTimeInSeconds: number,
  ): GroundSurface | undefined {
    const { hitObject } = resolveCircleMovement(body, deltaTimeInSeconds, this.ordered);
    return hitObject && (hitObject as GroundSurface).isGround
      ? (hitObject as GroundSurface)
      : undefined;
  }
}
