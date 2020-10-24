import { rgb255 } from './helper/rgb255';
import { CharacterTeam } from './objects/types/character-team';

const q = 2.5;
const qDim = 1.5;
const declaColor = rgb255(64 * q, 105 * q, 165 * q);
const neutralColor = rgb255(82 * q, 165 * q, 64 * q);
const redColor = rgb255(209 * q, 86 * q, 82 * q);
const declaColorDim = rgb255(64 * qDim, 105 * qDim, 165 * qDim);
const redColorDim = rgb255(209 * qDim, 8 * qDim, 82 * qDim);
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
  backgroundGradient: [rgb255(90, 38, 43), rgb255(0, 0, 0), rgb255(43, 39, 73)],
  declaColor,
  declaPlanetColor,
  redColor,
  redPlanetColor,
  colorIndices: {
    [CharacterTeam.decla]: 0,
    [CharacterTeam.neutral]: 1,
    [CharacterTeam.red]: 2,
  },
  palette: [declaColor, neutralColor, redColor],
  paletteDim: [declaColorDim, neutralColor, redColorDim],
  targetPhysicsDeltaTimeInMilliseconds: 20,
  minPhysicsSleepTime: 4,
  velocityAttenuation: 0.25,
  inViewAreaSize: 1920 * 1080 * 3,
};
