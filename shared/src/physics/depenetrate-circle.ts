import { vec2 } from 'gl-matrix';
import { PhysicsBody, Sdf } from './sdf';
import { evaluateSdf } from './evaluate-sdf';
import { sdfNormal } from './sdf-normal';

// Planet collision outlines rotate (see PlanetPhysical.distance), so a surface
// can sweep into a circle that hasn't itself moved. marchCircle assumes an
// overlap-free start — beginning inside, it registers a zero-distance hit and
// never moves again — so any overlap must be resolved here, before marching.
// Iterating handles concave spots, where leaving one face pushes into another;
// if no overlap-free position exists nearby (a crevice narrower than the
// circle), it gives up and leaves the rest to a later tick.
export const depenetrateCircle = (
  body: PhysicsBody,
  possibleIntersectors: Array<Sdf>,
) => {
  for (let i = 0; i < 4; i++) {
    const distance = evaluateSdf(body.center, possibleIntersectors);
    if (distance >= body.radius) {
      return;
    }

    const normal = sdfNormal(body.center, possibleIntersectors);
    if (vec2.squaredLength(normal) === 0) {
      return;
    }

    vec2.copy(body.lastNormal, normal);
    vec2.scaleAndAdd(body.center, body.center, normal, body.radius - distance + 0.01);
  }
};
