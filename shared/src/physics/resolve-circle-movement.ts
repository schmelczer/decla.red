import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { depenetrateCircle } from './depenetrate-circle';
import { marchCircle } from './march-circle';

// Position-resolution half of CirclePhysical.stepManually, extracted so server
// and client integrate a body identically. The caller owns the broadphase
// (gathering `possibleIntersectors`, incl. the swept-radius bump); everything
// from depenetration onward lives here. `onHit` is threaded to marchCircle so
// the backend dispatches collision reactions at the same points; the client
// passes none. Velocity is reset at the end — the character re-applies all
// forces from zero every tick, so retained velocity would double-integrate and diverge.
export const resolveCircleMovement = (
  body: PhysicsBody,
  deltaTimeInSeconds: number,
  possibleIntersectors: Array<Sdf>,
  onHit?: (intersecting: Sdf) => void,
): { hitObject?: Sdf; velocity: vec2 } => {
  let delta = vec2.scale(vec2.create(), body.velocity, deltaTimeInSeconds);

  depenetrateCircle(body, possibleIntersectors);

  const { normal, hitSurface, hitObject } = marchCircle(
    body,
    delta,
    possibleIntersectors,
    false,
    onHit,
  );

  if (hitSurface) {
    vec2.copy(body.lastNormal, normal!);

    vec2.subtract(
      body.velocity,
      body.velocity,
      vec2.scale(
        normal!,
        normal!,
        (1 + body.restitution) * vec2.dot(normal!, body.velocity),
      ),
    );

    if (vec2.length(body.velocity) > 50) {
      delta = vec2.scale(vec2.create(), body.velocity, deltaTimeInSeconds);
      marchCircle(body, delta, possibleIntersectors, false, onHit);
    }
  }

  const lastVelocity = vec2.clone(body.velocity);
  vec2.zero(body.velocity);

  return { hitObject, velocity: lastVelocity };
};
