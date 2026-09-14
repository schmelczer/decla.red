import { vec2 } from 'gl-matrix';
import {
  CharacterWorld,
  GroundSurface,
  Id,
  PhysicsBody,
  PlanetBase,
  resolveCircleMovement,
} from 'shared';
import { PlanetView } from '../../objects/types/planet-view';

export type PlanetSnapshot = Pick<
  PlanetView,
  'id' | 'vertices' | 'snapshotRotation' | 'snapshotRotationSpeed'
>;

// Planets only, re-seeded from the newest snapshot every frame; never dispatches collisions.
export class ClientCharacterWorld implements CharacterWorld {
  private surfaces: Array<PlanetBase> = [];

  public sync(planets: Array<PlanetSnapshot>) {
    this.surfaces = planets
      .map((planet) => {
        const surface = new PlanetBase(planet.id, planet.vertices);
        surface.rotation = planet.snapshotRotation;
        surface.angularVelocity = planet.snapshotRotationSpeed;
        return surface;
      })
      .sort((a, b) => a.id - b.id);
  }

  public advance(deltaTimeInSeconds: number) {
    this.surfaces.forEach((s) => s.advanceRotation(deltaTimeInSeconds));
  }

  public surfaceById(id: Id | null): GroundSurface | undefined {
    return this.surfaces.find((s) => s.id === id);
  }

  public groundsNear(_center: vec2, _radius: number): Array<GroundSurface> {
    return this.surfaces;
  }

  public stepBody(
    body: PhysicsBody,
    deltaTimeInSeconds: number,
  ): GroundSurface | undefined {
    const hit = resolveCircleMovement(body, deltaTimeInSeconds, this.surfaces);
    return hit instanceof PlanetBase ? hit : undefined;
  }
}
