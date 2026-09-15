import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

import { PhysicalContainer } from '../backend/src/physics/physical-container';
import { PlayerContainer } from '../backend/src/players/player-container';
import { createWorld } from '../backend/src/create-world';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const {
  Random,
  settings,
  TransportEvents,
  deserialize,
  CreateObjectsCommand,
  DeleteObjectsCommand,
  PropertyUpdatesForObjects,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  InputAcknowledgement,
  UpdateMinimap,
  ServerAnnouncement,
} = shared;

class FakeSocket {
  public readonly sent: Array<{ event: string; payload: unknown }> = [];
  public readonly conn = {
    transport: { socket: { bufferedAmount: 0 } },
    writeBuffer: [] as Array<{ data: unknown }>,
  };

  public set bufferedAmount(bytes: number) {
    this.conn.transport.socket.bufferedAmount = bytes;
  }

  public on() {}
  public off() {}
  public emit(event: string, payload?: unknown) {
    this.sent.push({ event, payload });
  }

  public get lastBatch(): Array<{ constructor: { name: string } }> {
    const last = [...this.sent]
      .reverse()
      .find((m) => m.event === TransportEvents.ServerToPlayer);
    return last ? deserialize(last.payload as string) : [];
  }
}

const makePlayer = () => {
  Random.seed = 3;
  const objects = new PhysicalContainer({ addPoints() {}, announce() {} });
  createWorld(objects);
  const players = new PlayerContainer(objects, 4, 0);
  const socket = new FakeSocket();
  const player = players.createPlayer({ name: 'player' }, socket as never);
  player.sendQueuedCommandsToClient();
  socket.sent.length = 0;
  return { player, socket };
};

const queueOneSnapshot = (player: ReturnType<typeof makePlayer>['player']) => {
  player.queueCommandSend(new CreateObjectsCommand([]));
  player.queueCommandSend(new DeleteObjectsCommand([1234]));
  player.queueCommandSend(new ServerAnnouncement('team blue wins'));
  player.queueCommandSend(new UpdateMinimap([]));
  player.queueCommandSend(
    new PropertyUpdatesForObjects(
      [
        new PropertyUpdatesForObject(1234, [
          new UpdatePropertyCommand('ownership', 1, 0),
        ]),
      ],
      1,
    ),
  );
  player.queueCommandSend(
    new InputAcknowledgement(123, player.character!.movementSnapshot, 0, 0),
  );
};

const typesIn = (batch: Array<{ constructor: { name: string } }>) =>
  batch.map((c) => c.constructor.name);

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
      InputAcknowledgement.name,
    ]);
  });

  it('reads the buffered byte count engine.io actually exposes', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    const marker = socket.lastBatch.find((c) => c instanceof PropertyUpdatesForObjects);
    expect(marker).toMatchObject({ updates: [], timestamp: 1 });
  });

  it('sheds only the state the next tick regenerates', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    const types = typesIn(socket.lastBatch);
    expect(types).toContain(PropertyUpdatesForObjects.name);
    expect(types).not.toContain(InputAcknowledgement.name);
    expect(types).not.toContain(UpdateMinimap.name);
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

  it('also measures packets waiting inside Engine.IO for the transport to drain', () => {
    const { player, socket } = makePlayer();
    socket.conn.writeBuffer.push({
      data: Buffer.alloc(settings.maxBufferedBytesPerClient + 1),
    });
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    const marker = socket.lastBatch.find((c) => c instanceof PropertyUpdatesForObjects);
    expect(marker).toMatchObject({ updates: [], timestamp: 1 });
    expect(typesIn(socket.lastBatch)).not.toContain(InputAcknowledgement.name);
  });

  it('sends a fresh pose and acknowledgement after the transport drains', () => {
    const { player, socket } = makePlayer();
    socket.bufferedAmount = settings.maxBufferedBytesPerClient + 1;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    socket.bufferedAmount = 0;
    queueOneSnapshot(player);
    player.sendQueuedCommandsToClient();

    const snapshot = socket.lastBatch.find((c) => c instanceof PropertyUpdatesForObjects);
    expect(snapshot).toMatchObject({ updates: [expect.anything()], timestamp: 1 });
    expect(typesIn(socket.lastBatch)).toContain(InputAcknowledgement.name);
  });
});
