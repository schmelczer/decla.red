import { vec2 } from 'gl-matrix';

// Minimal signed-distance collider. Backend Physicals and the client's planet
// surfaces both satisfy this.
export interface Sdf {
  readonly canCollide: boolean;
  // Planets set this so a body landing on one can latch it as ground; replaces
  // the server's `instanceof PlanetPhysical` with a structural flag both share.
  readonly isGround?: boolean;
  distance(target: vec2): number;
}

export interface PhysicsBody {
  center: vec2;
  radius: number;
  velocity: vec2;
  lastNormal: vec2;
  readonly restitution: number;
}

export interface GroundSurface extends Sdf {
  readonly isGround: true;
  readonly center: vec2;
  readonly angularVelocity: number;
  gravityAt(target: vec2): vec2;
}
