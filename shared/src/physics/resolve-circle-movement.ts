import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { depenetrateCircle } from './depenetrate-circle';
import { marchCircle } from './march-circle';

// The position-resolution half of the backend's CirclePhysical.stepManually,
// extracted so server and client integrate a body identically. The caller is
// responsible for the broadphase (gathering `possibleIntersectors`, including
// the swept-radius bump) because that depends on each side's spatial structure;
// everything from depenetration onward lives here.
//
// `onHit` is threaded through to marchCircle so the backend can dispatch its
// collision reactions at the same points as before (including the second,
// post-bounce slide march); the client passes none. Velocity is reset to zero
// at the end — the character re-applies all forces from zero every tick, so a
// body that retained velocity would double-integrate and diverge.
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
