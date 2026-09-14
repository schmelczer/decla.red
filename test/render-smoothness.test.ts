import { describe, it, expect } from 'vitest';
import {
  LocalCharacterPredictor,
  setFrameTimeMs,
} from '../frontend/src/scripts/helper/prediction/local-character-predictor';
import { ClientCharacterWorld } from '../frontend/src/scripts/helper/prediction/client-character-world';
import {
  stepCharacterMovement,
  tickPlanetDetachment,
  headRadius,
  feetRadius,
} from '../shared/src/physics/character-movement';
import { settings } from '../shared/src/settings';

const stepSeconds = settings.targetPhysicsDeltaTimeInSeconds;
const snapshotMs = settings.updateMessageInterval * 1000;
const heartbeatMs = settings.clientSendInterval * 1000;
const planetRadius = 800;

// The client's frame clock is rebased to its first frame (sdf-2d passes currentTime - startTime),
// so it shares no origin with the server's clock. Anything that only works when the two happen to
// agree is not a fix.
const clientClockOffsetMs = 987_654.321;

const vertices = Array.from({ length: settings.planetEdgeCount }, (_, i) => {
  const angle = (i / settings.planetEdgeCount) * -Math.PI * 2;
  return [planetRadius * Math.cos(angle), planetRadius * Math.sin(angle)];
});

const planetAt = (rotation: number) =>
  ({ id: 1, vertices, snapshotRotation: rotation, snapshotRotationSpeed: 0 }) as never;

const body = (center: Array<number>, radius: number) => ({
  center: center.slice(),
  radius,
  velocity: [0, 0],
  lastNormal: [0, 1],
  restitution: 0,
});

interface Conditions {
  fps: number;
  /** One way. The round trip is twice this. */
  wireMs: number;
  /** Client CPU spent between the frame timestamp and the socket emit at the end of the loop. */
  emitLagMs: number;
  /** Peak random variation in frame duration, as a fraction of the nominal frame. */
  frameJitter: number;
  /** Probability that a frame is missed entirely and the next one is twice as long. */
  dropRate: number;
  /** Server work that can delay a socket callback past the packet's arrival. */
  serverBusyMs: number;
  wireJitterMs?: number;
  emitJitterMs?: number;
  changeInput?: boolean;
}

interface Result {
  /** Peak-to-peak variation in apparent speed, over its mean. Zero means perfectly even motion. */
  speedSpread: number;
  /** How far the rendered character trails the true server pose, in world units. */
  lagUnits: number;
  finalError: number;
  maximumSpeed: number;
}

// Measure world travel: the camera tracks the local character exactly, so measuring
// their relative position would always report zero even when the world visibly stutters.
const measure = ({
  fps,
  wireMs,
  emitLagMs,
  frameJitter,
  dropRate,
  serverBusyMs,
  wireJitterMs = 0,
  emitJitterMs = 0,
  changeInput = false,
}: Conditions): Result => {
  const world = new ClientCharacterWorld();
  world.sync([planetAt(0)]);

  const server: any = {
    head: body([0, planetRadius + 90], headRadius),
    leftFoot: body([-33, planetRadius + 35], feetRadius),
    rightFoot: body([33, planetRadius + 35], feetRadius),
    direction: 0,
    currentPlanet: world.surfaceById(1),
    secondsSinceOnSurface: 0,
    bodyVelocity: [0, 0],
  };

  let input = [1, 0];
  let serverInput = [1, 0];
  const predictor = new LocalCharacterPredictor();
  predictor.setStrength(settings.playerMaxStrength);

  let seed = 12345;
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const nominalFrameMs = 1000 / fps;
  const toServer: Array<{ atMs: number; clientStampMs: number; direction?: number[] }> =
    [];
  const toClient: Array<{
    atMs: number;
    ackAgeMs: number;
    clientStampMs: number;
    pose: any;
  }> = [];
  const samples: Array<{
    world: Array<number>;
    atMs: number;
    error: number;
  }> = [];

  let simMs = 0;
  let nextSnapshotMs = 0;
  let nextFrameAtMs = 0;
  let lastHeartbeatClientMs = -Infinity;
  let lastInputClientTimeMs = 0;
  let lastInputReceiptMs = 0;
  let hasPressed = false;
  let lastServerArrivalMs = 0;
  let lastClientArrivalMs = 0;

  while (simMs < 8000) {
    tickPlanetDetachment(server, stepSeconds);
    stepCharacterMovement(server, world, serverInput.slice() as never, stepSeconds);
    simMs += stepSeconds * 1000;

    while (toServer.length > 0 && toServer[0].atMs <= simMs) {
      const packet = toServer.shift()!;
      if (packet.direction) serverInput = packet.direction;
      if (packet.clientStampMs > lastInputClientTimeMs) {
        lastInputClientTimeMs = packet.clientStampMs;
        // Socket callbacks run between physics frames, so this is the true arrival instant,
        // not the frame boundary — plus however long the frame in progress still had to run.
        lastInputReceiptMs = packet.atMs;
      }
    }

    if (simMs >= nextSnapshotMs) {
      nextSnapshotMs += snapshotMs;
      lastClientArrivalMs = Math.max(
        lastClientArrivalMs,
        simMs + Math.max(0, wireMs + (random() * 2 - 1) * wireJitterMs),
      );
      toClient.push({
        atMs: lastClientArrivalMs,
        clientStampMs: lastInputClientTimeMs,
        ackAgeMs: lastInputReceiptMs > 0 ? Math.max(0, simMs - lastInputReceiptMs) : 0,
        pose: {
          head: server.head.center.slice(),
          leftFoot: server.leftFoot.center.slice(),
          rightFoot: server.rightFoot.center.slice(),
          movement: {
            direction: server.direction,
            bodyVelocity: server.bodyVelocity.slice(),
            leftFootNormal: server.leftFoot.lastNormal.slice(),
            rightFootNormal: server.rightFoot.lastNormal.slice(),
            groundPlanetId: 1,
            secondsSinceOnSurface: server.secondsSinceOnSurface,
          },
        },
      });
    }

    while (toClient.length > 0 && toClient[0].atMs <= simMs) {
      const packet = toClient.shift()!;
      predictor.acknowledge(
        packet.clientStampMs,
        packet.pose.movement,
        -Infinity,
        packet.ackAgeMs,
      );
      predictor.setAuthoritative(
        { center: packet.pose.head, radius: headRadius } as never,
        { center: packet.pose.leftFoot, radius: feetRadius } as never,
        { center: packet.pose.rightFoot, radius: feetRadius } as never,
      );
    }

    while (nextFrameAtMs <= simMs) {
      const frameClientMs = nextFrameAtMs + clientClockOffsetMs;
      setFrameTimeMs(frameClientMs);

      // Movement input is edge-triggered, exactly as KeyboardListener sends it: recorded once
      // when the key goes down, then held by both sides.
      const desiredInput =
        changeInput && nextFrameAtMs >= 4500
          ? nextFrameAtMs >= 6000
            ? [0, 0]
            : [-1, 0]
          : [1, 0];
      const inputChanged = !hasPressed || desiredInput[0] !== input[0];
      if (inputChanged) {
        hasPressed = true;
        input = desiredInput;
        predictor.recordInput(input as never);
      }

      const dropped = random() < dropRate;
      const jitter = 1 + (random() * 2 - 1) * frameJitter;
      const frameMs = nominalFrameMs * jitter * (dropped ? 2 : 1);

      if (!dropped) {
        predictor.update([planetAt(0)]);
        const head = predictor.head.center;
        samples.push({
          world: [head[0], head[1]],
          atMs: frameClientMs,
          error: Math.hypot(
            head[0] - server.head.center[0],
            head[1] - server.head.center[1],
          ),
        });
      }

      // Stamped at the top of the frame, emitted at the bottom.
      if (
        inputChanged ||
        (!dropped && frameClientMs - lastHeartbeatClientMs >= heartbeatMs - 1)
      ) {
        lastHeartbeatClientMs = frameClientMs;
        lastServerArrivalMs = Math.max(
          lastServerArrivalMs,
          nextFrameAtMs +
            serverBusyMs +
            Math.max(0, emitLagMs + (random() * 2 - 1) * emitJitterMs) +
            Math.max(0, wireMs + (random() * 2 - 1) * wireJitterMs),
        );
        toServer.push({
          atMs: lastServerArrivalMs,
          clientStampMs: frameClientMs,
          direction: inputChanged ? input.slice() : undefined,
        });
      }

      nextFrameAtMs += frameMs;
    }
  }

  const tail = samples.slice(Math.floor(samples.length / 2));

  // Apparent speed: world travel divided by how long the frame was on screen. A longer frame
  // should show proportionally more travel; anything else reads as a lurch.
  const speeds = tail
    .slice(1)
    .map(
      (s, i) =>
        Math.hypot(s.world[0] - tail[i].world[0], s.world[1] - tail[i].world[1]) /
        (s.atMs - tail[i].atMs),
    );
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

  return {
    speedSpread: (Math.max(...speeds) - Math.min(...speeds)) / meanSpeed,
    lagUnits: tail.reduce((sum, s) => sum + s.error, 0) / tail.length,
    finalError: tail[tail.length - 1].error,
    maximumSpeed: Math.max(...speeds),
  };
};

const CONDITIONS: Array<[string, Conditions]> = [
  [
    'localhost, clean frames',
    { fps: 60, wireMs: 0.2, emitLagMs: 2, frameJitter: 0, dropRate: 0, serverBusyMs: 0 },
  ],
  [
    'localhost, 144 Hz',
    { fps: 144, wireMs: 0.2, emitLagMs: 2, frameJitter: 0, dropRate: 0, serverBusyMs: 0 },
  ],
  [
    'localhost, frame jitter',
    {
      fps: 60,
      wireMs: 0.2,
      emitLagMs: 2,
      frameJitter: 0.15,
      dropRate: 0,
      serverBusyMs: 0,
    },
  ],
  [
    'localhost, 2% dropped',
    {
      fps: 60,
      wireMs: 0.2,
      emitLagMs: 2,
      frameJitter: 0.05,
      dropRate: 0.02,
      serverBusyMs: 0,
    },
  ],
  [
    'localhost, slower CPU',
    {
      fps: 60,
      wireMs: 0.2,
      emitLagMs: 8,
      frameJitter: 0.15,
      dropRate: 0.02,
      serverBusyMs: 0,
    },
  ],
  [
    '30 ms link',
    {
      fps: 60,
      wireMs: 15,
      emitLagMs: 2,
      frameJitter: 0.05,
      dropRate: 0,
      serverBusyMs: 0,
    },
  ],
  [
    '120 ms link',
    {
      fps: 60,
      wireMs: 60,
      emitLagMs: 2,
      frameJitter: 0.05,
      dropRate: 0,
      serverBusyMs: 0,
    },
  ],
];

describe('local character render smoothness', () => {
  it.each(CONDITIONS)('keeps travel even with %s', (_label, conditions) => {
    const result = measure(conditions);
    expect(result.speedSpread).toBeLessThan(0.05);
    if (conditions.wireMs < 1) expect(result.lagUnits).toBeLessThan(5);
  });

  it('absorbs changing network and client CPU delay without snapshot jumps', () => {
    const result = measure({
      fps: 144,
      wireMs: 30,
      emitLagMs: 5,
      wireJitterMs: 10,
      emitJitterMs: 5,
      frameJitter: 0.15,
      dropRate: 0.02,
      serverBusyMs: 2,
    });
    expect(result.speedSpread).toBeLessThan(0.4);
    expect(result.lagUnits).toBeLessThan(25);
  });

  it('reconciles direction changes and stopping across an irregular link', () => {
    const result = measure({
      fps: 144,
      wireMs: 30,
      emitLagMs: 5,
      wireJitterMs: 10,
      emitJitterMs: 5,
      frameJitter: 0.15,
      dropRate: 0.02,
      serverBusyMs: 2,
      changeInput: true,
    });
    expect(result.maximumSpeed).toBeLessThan(1);
    expect(result.finalError).toBeLessThan(3);
  });
});
