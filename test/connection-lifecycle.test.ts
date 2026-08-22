// Drives the real GameServer through a fake socket.io to cover the connection
// lifecycle: the join guard, refusal reasons, and reconnect. None of this is
// reachable from a unit test of any single class, and it is where the audit
// found the most severe defects.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

import { GameServer } from '../backend/src/game-server';
import { defaultOptions } from '../backend/src/default-options';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { applyArrayPlugins, Random, TransportEvents, JoinRejectionReason, settings } =
  shared;

applyArrayPlugins();

class FakeSocket {
  public readonly sent: Array<{ event: string; payload: unknown }> = [];
  public disconnected = false;
  private handlers = new Map<string, Array<(...args: never[]) => void>>();

  public on(event: string, handler: (...args: never[]) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  public off(event: string, handler: (...args: never[]) => void) {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== handler),
    );
  }

  public emit(event: string, payload?: unknown) {
    this.sent.push({ event, payload });
  }

  public join() {}

  public disconnect() {
    this.disconnected = true;
  }

  /** Number of listeners the server has attached for an event. */
  public listenerCount(event: string): number {
    return (this.handlers.get(event) ?? []).length;
  }

  public fire(event: string, ...args: unknown[]) {
    for (const handler of [...(this.handlers.get(event) ?? [])]) {
      (handler as (...a: unknown[]) => void)(...args);
    }
  }

  public lastPayloadFor(event: string): unknown {
    return [...this.sent].reverse().find((m) => m.event === event)?.payload;
  }
}

class FakeIo {
  public connect?: (socket: FakeSocket) => void;
  public on(event: string, handler: (socket: FakeSocket) => void) {
    if (event === 'connection') {
      this.connect = handler;
    }
  }
  public to() {
    return { emit: () => undefined };
  }
}

const startServer = (overrides: Partial<typeof defaultOptions> = {}) => {
  const io = new FakeIo();
  const server = new GameServer(io as never, {
    ...defaultOptions,
    seed: 1,
    ...overrides,
  });
  const attach = () => {
    const socket = new FakeSocket();
    io.connect!(socket);
    return socket;
  };
  return { server, attach };
};

beforeEach(() => {
  Random.seed = 1;
});

describe('join guard', () => {
  // One socket used to be able to emit PlayerJoining as often as it liked, each
  // pass spawning another Player and stacking another set of listeners, until it
  // held every slot on the server.
  it('accepts exactly one join per connection', () => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 1 });
    const socket = attach();

    for (let i = 0; i < 8; i++) {
      socket.fire(TransportEvents.PlayerJoining, { name: 'greedy' });
    }

    expect(server.serverInfo.playerCount).toBe(1);
    expect(socket.listenerCount(TransportEvents.PlayerToServer)).toBe(1);
    expect(socket.listenerCount('disconnect')).toBe(1);
    expect(socket.lastPayloadFor(TransportEvents.JoinRejected)).toBe(
      JoinRejectionReason.AlreadyJoined,
    );
  });

  it('leaves room for everyone else', () => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 1 });
    const hog = attach();
    for (let i = 0; i < 8; i++) {
      hog.fire(TransportEvents.PlayerJoining, { name: 'greedy' });
    }

    const other = attach();
    other.fire(TransportEvents.PlayerJoining, { name: 'someone else' });

    expect(server.serverInfo.playerCount).toBe(2);
    expect(other.disconnected).toBe(false);
  });

  it('says why instead of hanging up silently when full', () => {
    const { attach } = startServer({ playerLimit: 1, npcCount: 0 });
    attach().fire(TransportEvents.PlayerJoining, { name: 'first' });

    const refused = attach();
    refused.fire(TransportEvents.PlayerJoining, { name: 'second' });

    expect(refused.lastPayloadFor(TransportEvents.JoinRejected)).toBe(
      JoinRejectionReason.ServerFull,
    );
  });
});

describe('hostile payloads', () => {
  it('survives a name that is not a string, without leaking a bot', () => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 2 });

    for (let i = 0; i < 4; i++) {
      attach().fire(TransportEvents.PlayerJoining, { name: ['CharacterBase'] });
    }

    // The joins are accepted (the name is coerced) and no bot is stranded.
    expect(server.serverInfo.playerCount).toBe(4);
  });

  it('ignores an oversized command batch instead of parsing it', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'sender' });

    // Would previously be handed straight to JSON.parse on the physics thread.
    expect(() =>
      socket.fire(TransportEvents.PlayerToServer, 'x'.repeat(2 * 1024 * 1024)),
    ).not.toThrow();
  });
});

describe('reconnect', () => {
  // A transport blip used to end the match: the client tore itself down and the
  // server deleted the character, with no way back to the same player.
  it('hands out a token on join and honours it on the way back', () => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 0 });

    const first = attach();
    first.fire(TransportEvents.PlayerJoining, { name: 'flaky' });
    const token = first.lastPayloadFor(TransportEvents.PlayerJoined);
    expect(typeof token).toBe('string');

    first.fire('disconnect');
    expect(server.serverInfo.playerCount).toBe(0);

    const second = attach();
    second.fire(TransportEvents.PlayerJoining, { name: 'flaky', reconnectToken: token });

    expect(server.serverInfo.playerCount).toBe(1);
    expect(second.disconnected).toBe(false);
    expect(second.lastPayloadFor(TransportEvents.JoinRejected)).toBeUndefined();
    // A fresh token for the new session, so the old one cannot be replayed.
    expect(second.lastPayloadFor(TransportEvents.PlayerJoined)).not.toBe(token);
  });

  it('treats an unknown token as an ordinary first join', () => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, {
      name: 'stranger',
      reconnectToken: 'not-a-real-token',
    });

    expect(server.serverInfo.playerCount).toBe(1);
    expect(socket.lastPayloadFor(TransportEvents.JoinRejected)).toBeUndefined();
  });
});

describe('inbound rate limiting', () => {
  // The bucket exists to survive a flood, but a dropped batch is LOST input,
  // not delayed input: movement is edge-triggered and nothing is ever re-sent,
  // so a discarded batch means the direction change simply never happened. The
  // ceiling used to be 120/s on the assumption of "one batch per frame", which
  // any display above 120 Hz exceeds outright — after the burst was spent, a
  // 144 Hz client had roughly one batch in six silently swallowed.
  //
  // Each message that gets past the limiter is unparseable and so logs exactly
  // once, which counts admissions without reaching into the server.
  const admitted = (socket: { fire: (e: string, p: string) => void }, count: number) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (let i = 0; i < count; i++) {
      socket.fire(TransportEvents.PlayerToServer, '{');
    }
    const seen = spy.mock.calls.length;
    spy.mockRestore();
    return seen;
  };

  // The allowance has to sit well clear of what a well-behaved client actually
  // sends, or the limiter eats gameplay input instead of floods. It used to be
  // 120/s against a client that sent once per rendered frame — a ratio below 1
  // for anyone on a 144 Hz display.
  it('allows several times what a well-behaved client sends', () => {
    const clientMessagesPerSecond = 1 / settings.clientSendInterval;

    expect(settings.maxInboundMessagesPerSecond).toBeGreaterThanOrEqual(
      clientMessagesPerSecond * 4,
    );
    expect(settings.maxInboundMessageBurst).toBeGreaterThanOrEqual(
      settings.maxInboundMessagesPerSecond,
    );
  });

  it('does not drop a second of a real client arriving at once', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'player' });

    // The paced heartbeat plus a generous allowance for discrete input events.
    const oneSecond = Math.ceil(1 / settings.clientSendInterval) + 100;

    expect(admitted(socket, oneSecond)).toBe(oneSecond);
  });

  it('still clamps an actual flood', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'flooder' });

    const flood = settings.maxInboundMessageBurst * 4;

    expect(admitted(socket, flood)).toBeLessThan(flood);
  });
});

describe('reconnect tokens', () => {
  // They used to be minted from `Random` — the seeded Mulberry32 stream shared
  // with world generation, NPC decisions and planet spin, the last of which is
  // streamed to every client. That made them guessable, and made every draw
  // after a join shift, so a seed no longer reproduced a match.
  const tokenFromFreshServer = () => {
    Random.seed = 1;
    const { attach } = startServer({ playerLimit: 4, npcCount: 0, seed: 1 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'player' });
    return socket.lastPayloadFor(TransportEvents.PlayerJoined) as string;
  };

  it('does not derive them from the seeded gameplay stream', () => {
    expect(tokenFromFreshServer()).not.toBe(tokenFromFreshServer());
  });

  // Shape, because that is what distinguishes the two sources: 122 random bits
  // from the platform CSPRNG, rather than a counter and one 32-bit draw off the
  // gameplay stream. Minting from `Random` also advanced the stream the world
  // generator runs on, so the same seed stopped replaying the same match — but
  // that is not assertable here: this harness seeds a different instance of the
  // shared bundle than the server source resolves.
  it('mints them from the platform CSPRNG, not the gameplay stream', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'player' });

    expect(socket.lastPayloadFor(TransportEvents.PlayerJoined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('socket listeners', () => {
  // The Player registers its own Pong listener, so nothing else knew to take it
  // off. A socket outlives the round it joined, so the retired Player stayed
  // reachable — and kept updating its RTT — through a listener nobody removed.
  it('takes every listener back off when the player drops', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'leaver' });

    expect(socket.listenerCount(TransportEvents.Pong)).toBe(1);

    socket.fire('disconnect');

    expect(socket.listenerCount(TransportEvents.Pong)).toBe(0);
    expect(socket.listenerCount(TransportEvents.PlayerToServer)).toBe(1);
  });

  it('does not stack a listener per reconnect', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });

    for (let i = 0; i < 5; i++) {
      const socket = attach();
      socket.fire(TransportEvents.PlayerJoining, { name: 'flaky' });
      expect(socket.listenerCount(TransportEvents.Pong)).toBe(1);
      socket.fire('disconnect');
    }
  });
});
