import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import { CommandSocket } from '../frontend/src/scripts/commands/command-socket';
import { setFrameTimeMs } from '../frontend/src/scripts/helper/prediction/local-character-predictor';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');
const { settings, MoveActionCommand, ClientHeartbeatCommand } = shared;

const drive = (
  frameRate: number,
  seconds: number,
  onFrame?: (socket: any) => void,
  connected = true,
) => {
  const batches: Array<string> = [];
  const socket = {
    connected,
    emit: (_event: string, payload: string) => batches.push(payload),
  };
  const commandSocket = new CommandSocket(socket as never);

  const frames = Math.round(frameRate * seconds);
  for (let f = 0; f < frames; f++) {
    setFrameTimeMs((f * 1000) / frameRate);
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
    let sentOn = -1;
    const batches = drive(144, 0.1, (commandSocket) => {
      if (sentOn === -1) {
        commandSocket.queue(new MoveActionCommand(vec2.fromValues(1, 0), 0));
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

  it('sends nothing at all while the transport is down', () => {
    const batches = drive(
      60,
      30,
      (commandSocket) =>
        commandSocket.queue(new MoveActionCommand(vec2.fromValues(1, 0), 0)),
      false,
    );

    expect(batches).toHaveLength(0);
  });
});
