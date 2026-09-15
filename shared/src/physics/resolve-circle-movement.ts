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
  depenetrateCircle(body, possibleIntersectors);
  let remainingSeconds = deltaTimeInSeconds;
  let firstHit: Sdf | undefined;

  for (let pass = 0; pass < 2 && remainingSeconds > 0; pass++) {
    const speed = vec2.length(body.velocity);
    if (speed === 0) {
      break;
    }
    const delta = vec2.scale(vec2.create(), body.velocity, remainingSeconds);
    const { normal, hitObject, travelled } = marchCircle(
      body,
      delta,
      possibleIntersectors,
      onHit,
    );
    if (!hitObject || !normal) {
      break;
    }
    firstHit ??= hitObject;
    vec2.copy(body.lastNormal, normal);
    remainingSeconds -= travelled / speed;
    const inwardSpeed = vec2.dot(normal, body.velocity);
    if (inwardSpeed < 0) {
      vec2.scaleAndAdd(
        body.velocity,
        body.velocity,
        normal,
        -(1 + body.restitution) * inwardSpeed,
      );
    }
  }

  return firstHit;
};
