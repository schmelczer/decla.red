import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { depenetrateCircle } from './depenetrate-circle';
import { marchCircle } from './march-circle';

export const resolveCircleMovement = (
  body: PhysicsBody,
  deltaTimeInSeconds: number,
  possibleIntersectors: Array<Sdf>,
  onHit?: (intersecting: Sdf) => void,
): Sdf | undefined => {
  let delta = vec2.scale(vec2.create(), body.velocity, deltaTimeInSeconds);

  depenetrateCircle(body, possibleIntersectors);

  const { normal, hitSurface, hitObject } = marchCircle(
    body,
    delta,
    possibleIntersectors,
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
      marchCircle(body, delta, possibleIntersectors, onHit);
    }
  }

  return hitObject;
};
