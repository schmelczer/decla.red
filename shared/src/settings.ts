import { vec2 } from 'gl-matrix';

export const settings = {
  lightCutoffDistance: 600,
  hitDetectionCirclePointCount: 32,
  hitDetectionMaxOverlap: 0.01,
  physicsMaxStep: 5,
  gravitationalForce: vec2.fromValues(0, -200),
  maxVelocityX: 500,
  maxVelocityY: 750,
  maxAccelerationX: 16000,
  maxAccelerationY: 5500,
  targetPhysicsDeltaTimeInMilliseconds: 15,
  minPhysicsSleepTime: 4,
  velocityAttenuation: 0.5,
  frictionMinVelocity: 400,
  inViewAreaSize: 1920 * 1080 * 3,
  defaultJumpEnergy: 0.75,
};
