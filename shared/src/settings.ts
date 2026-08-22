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
  // How far behind the estimated server time remote state is rendered: ~2.5
  // update intervals, so a late packet rarely leaves the client without a
  // newer snapshot to interpolate towards.
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
  // Half-width of the neutral dead-band around 50% ownership. A planet only
  // counts as captured (team(), point generation, flip) once |ownership-0.5|
  // exceeds this, and the rendered ownership ring stays neutral until the same
  // point — so what you see matches what scores.
  planetControlThreshold: 0.12,
  // Extra margin a planet must clear *beyond* planetControlThreshold before a
  // capture flip pays out again (a Schmitt trigger). Without it, ownership
  // hovering on the dead-band edge re-triggers the reward, the announcement and
  // the flare every time it grazes the boundary.
  planetFlipHysteresis: 0.06,
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
  playerColorIndexOffset: 3,
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

  // Projectiles fall through planetary gravity like a free-falling character,
  // so slower (charged) shots arc. Scale kept tiny: near a surface gravity is
  // maxGravityStrength=50000, which at full strength would corkscrew a shot into
  // the planet — 0.04 gives a readable bend instead.
  projectileGravityScale: 0.04,

  // Speed the corpse is flung at along the killing shot's direction, lerped by
  // that shot's charge. Added to whatever momentum the victim already carried.
  deathImpulseMin: 280,
  deathImpulseMax: 1300,

  // A planet's net team head-count drives a single capture step per tick; the
  // lead multiplier is capped so a zerg can't flip instantly. Equal head-counts
  // freeze the planet (contested) instead of silently cancelling.
  maxContestLeadMultiplier: 2,

  // Persistent body momentum decays per second by these exponents. Airborne is
  // near-frictionless so leaps and slingshots carry across the gaps; grounded is
  // stiff so you skid to a stop on landing rather than sliding forever.
  airMomentumFriction: 0.4,

  groundMomentumFriction: 7,

  // On top of the exponential frictions above, a constant deceleration (u/s^2)
  // applied to body momentum. The exponential alone only asymptotes toward zero,
  // so a fast launch keeps a slow tail for 15+ seconds — it reads as drifting
  // forever with nothing slowing you. This constant brake brings the momentum to
  // a definite stop in a couple of seconds, while the gentle exponential still
  // lets the launch cover its distance first.

  momentumStopDeceleration: 400,
  // Hard ceiling (u/s) on body momentum, so stacked impulses — rapid charged-shot
  // recoil, or a leap chained into a spin slingshot — can't build speed without
  // bound. Kept above the overcharge fling (1700) so single launches survive.

  maxBodyMomentum: 2000,

  // Leap: a charged-cost launch off a surface, paid from the shared shooting
  // strength pool so it trades against firepower.
  leapStrengthCost: 32,

  leapSpeed: 1350,
  leapUpBias: 1,
  leapMoveBias: 0.65,
  leapCooldownSeconds: 0.35,

  // Fraction of the planet's tangential surface velocity you keep when you leave
  // it (slingshot). Leap off a fast spinner to be flung far.
  slingshotScale: 1,

  // Recoil speed imparted opposite a shot, scaled by its charge (0 for taps).
  chargeShotRecoilMax: 650,

  // Lag compensation for projectiles. A shot is fast-forwarded by the time its
  // command spent reaching the server, so the shooter does not have to lead by
  // their own latency on top of the projectile's travel time. Capped so a very
  // bad (or forged) timestamp cannot spawn a shot arbitrarily far downrange.
  maxProjectileCatchUpSeconds: 0.2,

  // How long a dropped player's score and team are held so a reconnect within
  // the window rejoins as the same player instead of a blank slate.
  reconnectGraceSeconds: 30,

  // Hard ceiling on one inbound client message. socket.io's 1 MB default is far
  // more than any legitimate command batch, and parsing is synchronous with the
  // physics loop — a single oversized message stalls the tick for everyone.
  maxInboundMessageBytes: 16 * 1024,

  // How often an idle client flushes its command queue. Input is flushed on the
  // frame it happens, so this only paces the heartbeat that keeps the server's
  // input acknowledgement moving while a key is simply held.
  //
  // It must NOT be the frame rate. Sending once per rendered frame put a 144 Hz
  // display permanently over the inbound allowance below, and once the burst was
  // spent the server silently discarded whole batches — including the
  // edge-triggered movement commands, which are never re-sent, so the player
  // kept walking the old way until they pressed something else.
  clientSendInterval: 1 / 30,

  // Inbound allowance per socket: a token bucket sized far above anything a
  // legitimate client produces (a 30 Hz heartbeat plus whatever discrete input
  // events a human generates), so it only ever trips on a flood. Dropping a
  // batch loses real input, so the headroom is deliberate.
  maxInboundMessagesPerSecond: 240,
  maxInboundMessageBurst: 480,

  // Ceiling on a measured round-trip time. The Pong that carries it comes from
  // the client, which can always answer late; the nonce check makes the reply
  // unforgeable and single-use, and this bounds what stalling one can buy.
  maxMeasuredRttMs: 1000,

  // Skip the bulky part of a snapshot when the socket already has this much
  // unflushed. A slow or stalled client otherwise accumulates a backlog it will
  // never catch up on, and the newest snapshot is the only one that matters.
  maxBufferedBytesPerClient: 256 * 1024,

  // Sanity bound on a client-supplied world position (the arena is
  // worldRadius across, so anything past this is nonsense).
  maxClientPositionMagnitude: 1e6,

  // The central giant is a named, always-contested focus. Its neutral decay is
  // slowed so control lingers and teams keep fighting over it; flips are
  // announced to everyone and an off-screen arrow points the way.
  keystoneLoseControlScale: 2.5,
};
