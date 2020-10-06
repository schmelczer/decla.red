import { vec2 } from 'gl-matrix';

export const settings = {
  lightCutoffDistance: 600,
  hitDetectionCirclePointCount: 32,
  hitDetectionMaxOverlap: 0.01,
  physicsMaxStep: 5,
  gravitationalForce: vec2.fromValues(0, -0.005),
  maxVelocityX: 1.5,
  maxVelocityY: 20,
  velocityAttenuation: 0.98,
  inViewAreaSize: 1920 * 1080 * 3,
};
