import { rgb255 } from './helper/rgb255';

const q = 2.5;
const declaColor = rgb255(64 * q, 105 * q, 165 * q);
const redColor = rgb255(209 * q, 86 * q, 82 * q);
const declaPlanetColor = declaColor;
const redPlanetColor = redColor;

export const settings = {
  lightCutoffDistance: 600,
  physicsMaxStep: 2,
  maxVelocityX: 1000,
  maxVelocityY: 1000,
  radiusSteps: 500,
  worldRadius: 10000,
  objectsOnCircleLength: 0.002,
  planetEdgeCount: 7,
  takeControlTimeInSeconds: 4,
  maxGravityDistance: 700,
  maxGravityQ: 180,
  planetControlThreshold: 0.2,
  playerMaxHealth: 100,
  maxGravityStrength: 10000,
  maxAcceleration: 10000,
  playerMaxStrength: 80,
  playerDiedTimeout: 5,
  playerStrengthRegenerationPerSeconds: 40,
  projectileMaxStrength: 40,
  projectileSpeed: 4000,
  projectileMaxBounceCount: 1,
  projectileTimeout: 3,
  projectileFadeSpeed: 20,
  projectileCreationInterval: 0.1,
  playerColorIndexOffset: 3,
  backgroundGradient: [rgb255(90, 38, 43), rgb255(43, 39, 73)],
  declaColor,
  declaPlanetColor,
  redColor,
  redPlanetColor,
  declaIndex: 0,
  redIndex: 1,
  palette: [declaColor, redColor],
  targetPhysicsDeltaTimeInMilliseconds: 20,
  minPhysicsSleepTime: 4,
  velocityAttenuation: 0.25,
  inViewAreaSize: 1920 * 1080 * 3,
};
