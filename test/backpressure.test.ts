// What a Player sheds when its socket stops draining. The guard used to read
// `socket.conn.bufferedAmount`, which engine.io's Socket does not have, so it
// never once ran — and had it run, it dropped the whole batch, including the
// create/delete that handleViewAreaUpdate had already committed to having sent.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

import { PhysicalContainer } from '../backend/src/physics/containers/physical-container';
import { PlayerContainer } from '../backend/src/players/player-container';
import { createWorld } from '../backend/src/create-world';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const {
  applyArrayPlugins,
  Random,
  settings,
  TransportEvents,
  deserialize,
  CreateObjectsCommand,
  DeleteObjectsCommand,
  PropertyUpdatesForObjects,
  UpdateMinimap,
  ServerAnnouncement,
} = shared;

applyArrayPlugins();

// A socket whose write buffer we control, shaped the way engine.io really nests
// it: the byte count lives on the ws socket under the transport.
class FakeSocket {
  public readonly sent: Array<{ event: string; payload: unknown }> = [];
  public readonly conn = { transport: { socket: { bufferedAmount: 0 } } };

  public set bufferedAmount(bytes: number) {
    this.conn.transport.socket.bufferedAmount = bytes;
  }

  public on() {}
  public off() {}
  public emit(event: string, payload?: unknown) {
    this.sent.push({ event, payload });
  }

  public get lastBatch(): Array<{ type: string }> {
    const last = [...this.sent]
      .reverse()
      .find((m) => m.event === TransportEvents.ServerToPlayer);
    return last ? deserialize(last.payload as string) : [];
  }
}

const makePlayer = () => {
  Random.seed = 3;
  const objects = new PhysicalContainer();
  createWorld(objects);
  objects.initialize();
  const players = new PlayerContainer(objects, 4, 0);
  const socket = new FakeSocket();
  const player = players.createPlayer({ name: 'player' }, socket as never);
  // The constructor already queues this player's own CreatePlayerCommand; flush
  // it so each case starts from an empty queue.
  player.sendQueuedCommandsToClient();
  socket.sent.length = 0;
  return { player, socket };
};

// One snapshot's worth of queued traffic: the bulky repeated state, and the
// one-shot bookkeeping that is never regenerated.
const queueOneSnapshot = (player: ReturnType<typeof makePlayer>['player']) => {
  player.queueCommandSend(new CreateObjectsCommand([]));
  player.queueCommandSend(new DeleteObjectsCommand([1234]));
  player.queueCommandSend(new ServerAnnouncement('team blue wins'));
  player.queueCommandSend(new UpdateMinimap([]));
  player.queueCommandSend(new PropertyUpdatesForObjects([], 1));
};

const typesIn = (batch: Array<{ type: string }>) => batch.map((c) => c.type);

describe('slow-client backpressure', () => {
  beforeEach(() => {
    Random.seed = 3;
  });

  it('sends everything while the socket is draining', () => {
    const { player, socket } = makePlayer();
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    expect(typesIn(socket.lastBatch)).toEqual([
      CreateObjectsCommand.name,
      DeleteObjectsCommand.name,
      ServerAnnouncement.name,
      UpdateMinimap.name,
      PropertyUpdatesForObjects.name,
    ]);
  });

  it('reads the buffered byte count engine.io actually exposes', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    // If the guard cannot see the buffer it degrades to sending everything, so
    // anything shed at all proves it is reading the right property.
    expect(typesIn(socket.lastBatch)).not.toContain(PropertyUpdatesForObjects.name);
  });

  it('sheds only the state the next tick regenerates', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    const types = typesIn(socket.lastBatch);
    // Repeated in full every tick — safe to drop.
    expect(types).not.toContain(PropertyUpdatesForObjects.name);
    expect(types).not.toContain(UpdateMinimap.name);
    // One-shot. handleViewAreaUpdate has already advanced its record of what
    // this client knows, so these are never re-derived: dropping them leaves the
    // client permanently missing objects and holding ghosts.
    expect(types).toContain(CreateObjectsCommand.name);
    expect(types).toContain(DeleteObjectsCommand.name);
    expect(types).toContain(ServerAnnouncement.name);
  });

  it('stays quiet when a backed-up client has nothing but sheddable state', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    player.queueCommandSend(new PropertyUpdatesForObjects([], 1));
    const before = socket.sent.length;
    player.sendQueuedCommandsToClient();

    expect(socket.sent.length).toBe(before);
  });
});
