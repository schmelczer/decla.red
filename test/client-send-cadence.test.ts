// The client's outbound cadence, which is what the server's inbound allowance
// has to be sized against. Sending once per rendered frame put every display
// above the allowance permanently over it; once the burst was spent the server
// silently discarded whole batches, and movement commands are edge-triggered
// and never re-sent, so a lost batch meant the direction change never happened.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import { CommandSocket } from '../frontend/src/scripts/commands/command-socket';
import { setPredictorClockForTesting } from '../frontend/src/scripts/helper/prediction/local-character-predictor';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');
const { applyArrayPlugins, settings, MoveActionCommand, ClientHeartbeatCommand } = shared;

applyArrayPlugins();

// Collects what would go on the wire.
const drive = (frameRate: number, seconds: number, onFrame?: (socket: any) => void) => {
  let clock = 0;
  setPredictorClockForTesting(() => clock);

  const batches: Array<string> = [];
  const socket = { emit: (_event: string, payload: string) => batches.push(payload) };
  const commandSocket = new CommandSocket(socket as never);

  const frames = Math.round(frameRate * seconds);
  for (let f = 0; f < frames; f++) {
    clock = (f * 1000) / frameRate;
    onFrame?.(commandSocket);
    commandSocket.sendQueuedCommands();
  }
  return batches;
};

describe('client send cadence', () => {
  it('is paced by the clock, not by the frame rate', () => {
    const seconds = 3;
    const expected = seconds / settings.clientSendInterval;

    for (const frameRate of [60, 144, 240]) {
      const batches = drive(frameRate, seconds);
      // One heartbeat per interval, give or take where the frames fall. The
      // point is that the count barely moves across a 4x range of frame rates —
      // sending once per frame gave 180, 432 and 720 here.
      expect(batches.length).toBeLessThanOrEqual(expected * 1.1);
      expect(batches.length).toBeGreaterThanOrEqual(expected * 0.85);
    }
  });

  it('stays under the server allowance even at an absurd frame rate', () => {
    const seconds = 5;
    const batches = drive(1000, seconds);

    expect(batches.length / seconds).toBeLessThan(settings.maxInboundMessagesPerSecond);
  });

  it('still flushes real input on the frame it happens', () => {
    // Input on frame 1 of a 144 Hz client: far inside the heartbeat interval, so
    // pacing must not hold it back. Latency the player feels is one frame.
    let sentOn = -1;
    const batches = drive(144, 0.1, (commandSocket) => {
      if (sentOn === -1) {
        commandSocket.handleCommand(new MoveActionCommand(vec2.fromValues(1, 0), 0));
        sentOn = 0;
      }
    });

    expect(batches.length).toBeGreaterThan(0);
    expect(batches[0]).toContain('MoveActionCommand');
  });

  it('closes every batch with a heartbeat, so a held key keeps the ack moving', () => {
    const batches = drive(60, 1);

    expect(batches.length).toBeGreaterThan(0);
    expect(batches.every((b) => b.includes(ClientHeartbeatCommand.name))).toBe(true);
  });
});
