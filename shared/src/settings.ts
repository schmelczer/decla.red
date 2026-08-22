import { rgb255 } from './helper/rgb255';
import { CharacterTeam } from './objects/types/character-base';

const blueColor = rgb255(64, 105, 165);
const neutralColor = rgb255(82, 165, 64);
const redColor = rgb255(209, 86, 82);
const q = 2.5;
const blueColorDim = rgb255(64 * q, 105 * q, 165 * q);
const redColorDim = rgb255(209 * q, 86 * q, 82 * q);
const bluePlanetColor = blueColorDim;
const redPlanetColor = redColorDim;

export const settings = {
  lightCutoffDistance: 600,
  lightOverlapReduction: 0.85,
  radiusSteps: 500,
  spawnDespawnTime: 0.7,
  worldRadius: 4000,
  objectsOnCircleLength: 0.002,
  updateMessageInterval: 1 / 25,
  interpolationDelaySeconds: 0.1,
  planetEdgeCount: 7,
  playerKillPoint: 25,
  takeControlTimeInSeconds: 2.5,
  loseControlTimeInSeconds: 16,
  planetPointGenerationInterval: 1.5,
  planetPointGenerationValue: 1,
  planetSizePointMultiplierMax: 4,
  captureFlipPointReward: 12,
  maxGravityDistance: 800,
  minGravityDistance: 1,
  maxGravityQ: 5000,
  // Neutral dead-band around 50% ownership. The single capture rule: flips,
  // scoring and every client-side tint all read PlanetBase.team.
  planetControlThreshold: 0.12,
  playerMaxHealth: 100,
  maxGravityStrength: 50000,
  planetMinReferenceRadius: 150,
  planetMaxReferenceRadius: 1200,
  maxAcceleration: 120000,
  playerMaxStrength: 80,
  endGameDeltaScaling: 2,
  playerDiedTimeout: 5,
  playerStrengthRegenerationPerSeconds: 80,
  playerOutOfCombatDelaySeconds: 5,
  playerHealthRegenerationPerSeconds: 8,
  playerKillHealthReward: 25,
  spawnInvulnerabilityExtraSeconds: 0.4,
  spawnSafetyDistance: 2000,
  touchAimRange: 1000,
  postureHeadStiffness: 12,
  postureFeetStiffness: 10,
  planetDetachmentSeconds: 0.5,
  planetDetachmentForceThreshold: 100,
  climbDotThreshold: 0.8,
  climbGravityScale: 0.35,
  projectileMaxStrength: 40,
  projectileMaxBounceCount: 2,
  projectileFadeSpeed: 20,
  projectileCreationInterval: 0.1,
  chargeShotFullHoldSeconds: 0.7,
  chargeShotStrengthMin: 40,
  chargeShotStrengthMax: 100,
  chargeShotRadiusMin: 20,
  chargeShotRadiusMax: 32,
  chargeShotSpeedMin: 2500,
  chargeShotSpeedMax: 3400,
  backgroundGradient: [rgb255(90, 38, 43), rgb255(43, 39, 73)],
  blueColor,
  bluePlanetColor,
  npcNames: [
    'Adam',
    'Andrew',
    'Blaise',
    'Clarence',
    'Dean',
    'Dustin',
    'Elliot',
    'Ernie',
    'Ethan',
    'Frank',
    'Fred',
    'George',
    'Graham',
    'Harold',
    'Harvey',
    'Henry',
    'Mingan',
    'Irving',
    'Irwin',
    'Jason',
    'Jenssen',
    'Josh',
    'Ladislaus',
    'Larry',
    'Lester',
    'Martin',
    'Marvin',
    'Neil',
    'Nick',
    'Niles',
    'Norm',
    'Oliver',
    'Orin',
    'Pat',
    'Perry',
    'Ron',
    'Ryan',
    'Sisyphus',
    'Tim',
    'Toby',
    'Ulysses',
    'Uri',
    'Waldo',
    'Wally',
    'Walt',
    'Wesley',
    'Will',
    'Wyatt',
  ],
  redColor,
  redPlanetColor,
  colorIndices: {
    [CharacterTeam.blue]: 0,
    [CharacterTeam.neutral]: 1,
    [CharacterTeam.red]: 2,
  },
  palette: [blueColor, neutralColor, redColor],
  paletteDim: [blueColorDim, neutralColor, redColorDim],
  targetPhysicsDeltaTimeInSeconds: 1 / 200,
  inViewAreaSize: 1920 * 1080 * 4,
  scoreboardHalfWidthPercent: 50,
  scoreboardMinFillPercent: 1.5,
  matchPointScoreRatio: 0.9,
  lampLerpSeconds: 0.5,
  lampMinLightness: 0.4,
  lampMaxLightness: 1,
  lampFlareIntensity: 1.2,
  lampFlareDecaySeconds: 0.6,
  maxConcurrentFlipFlares: 3,
  announcementVisibleSeconds: 2,

  chargedHitThreshold: 0.6,

  projectileGravityScale: 0.04,

  deathImpulseMin: 280,
  deathImpulseMax: 1300,

  maxContestLeadMultiplier: 2,

  airMomentumFriction: 0.4,

  groundMomentumFriction: 7,

  momentumStopDeceleration: 400,

  maxBodyMomentum: 2000,

  leapStrengthCost: 32,

  leapSpeed: 1350,
  leapUpBias: 1,
  leapMoveBias: 0.65,
  leapCooldownSeconds: 0.35,

  slingshotScale: 1,

  chargeShotRecoilMax: 650,

  // DoS guard: parsing is synchronous with the physics loop, so one oversized
  // message stalls the tick for everyone.
  maxInboundMessageBytes: 16 * 1024,

  // Must NOT be the frame rate: per-render-frame sends exceed the inbound
  // allowance on high-Hz displays, and dropped batches lose edge-triggered
  // movement commands that are never re-sent.
  clientSendInterval: 1 / 30,

  maxInboundMessagesPerSecond: 240,
  maxInboundMessageBurst: 480,

  // The nonce check makes the Pong reply unforgeable/single-use; this bounds
  // what stalling one can buy.
  maxMeasuredRttMs: 1000,

  maxBufferedBytesPerClient: 256 * 1024,

  maxClientPositionMagnitude: 1e6,

  keystoneLoseControlScale: 2.5,
};
