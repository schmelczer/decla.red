import { vec2 } from 'gl-matrix';

// Minimal signed-distance collider the geometry functions need. Backend
// Physicals and the client's planet surfaces both satisfy this structurally.
export interface Sdf {
  readonly canCollide: boolean;
  // Planets set this true so a body landing on one can latch it as ground;
  // everything else leaves it falsy. Replaces the server's
  // `instanceof PlanetPhysical` check with a structural flag both sides share.
  readonly isGround?: boolean;
  distance(target: vec2): number;
}

// A movable circle the geometry resolves in place. Backend CirclePhysical and
// the client predictor's plain bodies both satisfy this.
export interface PhysicsBody {
  center: vec2;
  radius: number;
  velocity: vec2;
  lastNormal: vec2;
  readonly restitution: number;
}

// A planet-like surface: collidable, exerts gravity, and spins. Drives the
// character's on-surface movement branch.
export interface GroundSurface extends Sdf {
  readonly isGround: true;
  readonly center: vec2;
  readonly angularVelocity: number;
  gravityAt(target: vec2): vec2;
}
