// Connection lifecycle: join guard, refusal reasons, reconnect — driven through a fake socket.io.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';

import { GameServer } from '../backend/src/game-server';
import { defaultOptions } from '../backend/src/options';

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

    expect(server.serverInfo.playerCount).toBe(4);
  });

  // socket.io dispatches listeners with no try/catch of its own, so anything
  // thrown out of a connection-scoped handler is an uncaught exception: the
  // process exits and every player in the match is dropped with it.
  it.each([
    ['no payload at all', undefined],
    ['null', null],
    ['a string', 'not-an-object'],
    ['a number', 7],
  ])('refuses a join payload that is %s instead of throwing', (_label, payload) => {
    const { server, attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();

    expect(() => socket.fire(TransportEvents.PlayerJoining, payload)).not.toThrow();
    expect(socket.lastPayloadFor(TransportEvents.JoinRejected)).toBe(
      JoinRejectionReason.InvalidRequest,
    );
    expect(server.serverInfo.playerCount).toBe(0);
  });

  it('ignores an oversized command batch instead of parsing it', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'sender' });

    expect(() =>
      socket.fire(TransportEvents.PlayerToServer, 'x'.repeat(2 * 1024 * 1024)),
    ).not.toThrow();
  });
});

describe('reconnect', () => {
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
    // Fresh token: the old one cannot be replayed.
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
  const admitted = (socket: { fire: (e: string, p: string) => void }, count: number) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (let i = 0; i < count; i++) {
      socket.fire(TransportEvents.PlayerToServer, '{');
    }
    const seen = spy.mock.calls.length;
    spy.mockRestore();
    return seen;
  };

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

describe('pre-join rate limiting', () => {
  // These listeners exist before any join, so the limiter inside
  // onPlayerToServer never sees them: unmetered, each one is a reply or an
  // allocation an unauthenticated client can ask for at line rate.
  it('clamps a flood of joins on an already-joined connection', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'flooder' });

    const flood = settings.maxInboundMessageBurst * 4;
    for (let i = 0; i < flood; i++) {
      socket.fire(TransportEvents.PlayerJoining, { name: 'flooder' });
    }

    const rejections = socket.sent.filter(
      (m) => m.event === TransportEvents.JoinRejected,
    );
    expect(rejections.length).toBeLessThan(flood);
  });

  it('clamps a flood of server-info subscriptions', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    let joins = 0;
    socket.join = () => {
      joins++;
    };

    const flood = settings.maxInboundMessageBurst * 4;
    for (let i = 0; i < flood; i++) {
      socket.fire(TransportEvents.SubscribeForServerInfoUpdates);
    }

    expect(joins).toBeLessThan(flood);
  });
});

describe('reconnect tokens', () => {
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

  it('mints them from the platform CSPRNG, not the gameplay stream', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'player' });

    expect(socket.lastPayloadFor(TransportEvents.PlayerJoined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('reconnect while the dropped socket is still live', () => {
  // engine.io needs ~45 s to notice a transport drop; the client is back in ~1 s.
  it('retires the ghost so the returning player keeps its slot, team and score', () => {
    const { server, attach } = startServer({ playerLimit: 1, npcCount: 0 });

    const first = attach();
    first.fire(TransportEvents.PlayerJoining, { name: 'flaky' });
    const token = first.lastPayloadFor(TransportEvents.PlayerJoined) as string;
    expect(server.serverInfo.playerCount).toBe(1);

    // No 'disconnect' fired: the server still holds the dead socket's player.
    const second = attach();
    second.fire(TransportEvents.PlayerJoining, { name: 'flaky', reconnectToken: token });

    expect(second.lastPayloadFor(TransportEvents.JoinRejected)).toBeUndefined();
    expect(second.lastPayloadFor(TransportEvents.PlayerJoined)).toBeTruthy();
    expect(server.serverInfo.playerCount).toBe(1);
    expect(first.listenerCount(TransportEvents.PlayerToServer)).toBe(0);
  });

  it('does not hand a slot to an unknown token', () => {
    const { server, attach } = startServer({ playerLimit: 1, npcCount: 0 });

    attach().fire(TransportEvents.PlayerJoining, { name: 'holder' });

    const stranger = attach();
    stranger.fire(TransportEvents.PlayerJoining, {
      name: 'stranger',
      reconnectToken: 'not-a-real-token',
    });

    expect(stranger.lastPayloadFor(TransportEvents.JoinRejected)).toBe(
      JoinRejectionReason.ServerFull,
    );
    expect(server.serverInfo.playerCount).toBe(1);
  });
});

describe('socket listeners', () => {
  it('takes every listener back off when the player drops', () => {
    const { attach } = startServer({ playerLimit: 4, npcCount: 0 });
    const socket = attach();
    socket.fire(TransportEvents.PlayerJoining, { name: 'leaver' });

    expect(socket.listenerCount(TransportEvents.Pong)).toBe(1);

    socket.fire('disconnect');

    expect(socket.listenerCount(TransportEvents.Pong)).toBe(0);
    expect(socket.listenerCount(TransportEvents.PlayerToServer)).toBe(0);
    expect(socket.listenerCount('disconnect')).toBe(0);
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
