import { vec2 } from 'gl-matrix';

export interface Sdf {
  readonly canCollide: boolean;
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
