import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CharacterBase,
  CharacterTeam,
  Circle,
  CreateObjectsCommand,
  DeleteObjectsCommand,
  GameObject,
  PropertyUpdatesForObjects,
  RemoteCall,
  RemoteCallsForObject,
  RemoteCallsForObjects,
} from '../frontend/node_modules/shared';
import { GameObjectContainer } from '../frontend/src/scripts/objects/game-object-container';
import { PlanetView } from '../frontend/src/scripts/objects/types/planet-view';
import { serverTimeline } from '../frontend/src/scripts/helper/server-timeline';

vi.mock('../frontend/src/scripts/objects/types/camera', () => ({
  Camera: class {
    draw() {}
    follow() {}
  },
}));
vi.mock('../frontend/src/scripts/objects/types/planet-view', () => ({
  PlanetView: class {
    beforeDestroy = vi.fn();
    render = vi.fn();
    processRemoteCalls = vi.fn();
    step() {}
    constructor(public id: number) {}
  },
}));
vi.mock('../frontend/src/scripts/sound-handler', () => ({
  SoundHandler: { play: vi.fn() },
  Sounds: {},
}));
vi.mock('../frontend/src/scripts/feedback-hud', () => ({ FeedbackHud: {} }));

let nowMs = 0;
beforeEach(() => {
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  serverTimeline.reset();
});
afterEach(() => vi.restoreAllMocks());

function character(id = 1) {
  const pose = new Circle([0, 0], 10);
  const object = new CharacterBase(
    id,
    'Remote player',
    0,
    0,
    CharacterTeam.red,
    100,
    pose,
    pose,
    pose,
  );
  return Object.assign(object, {
    step: vi.fn(),
    render: vi.fn(),
    beforeDestroy: vi.fn(),
    // A health setter also represents damage sound/flash feedback in CharacterView.
    setHealth: vi.fn((health: number) => (object.health = health)),
    onShoot: vi.fn(),
    onDie: vi.fn(),
  });
}

function calls(
  container: GameObjectContainer,
  id: number,
  ...entries: Array<[string, ...unknown[]]>
) {
  container.handleCommand(
    new RemoteCallsForObjects([
      new RemoteCallsForObject(
        id,
        entries.map(([name, ...args]) => new RemoteCall(name, args)),
      ),
    ]),
  );
}

function snapshot(container: GameObjectContainer, timestamp: number) {
  nowMs = (timestamp - 5) * 1000;
  container.handleCommand(new PropertyUpdatesForObjects([], timestamp));
}

function retained(container: GameObjectContainer) {
  return container as unknown as {
    objects: Map<number, unknown>;
    deleteAt: Map<number, number>;
    remoteCalls: Array<{ object: unknown }>;
  };
}

describe('suspended rendering', () => {
  it('bounds deleted views and effect batches as snapshots arrive without frames', () => {
    const container = new GameObjectContainer({} as never);
    const survivor = character();
    container.handleCommand(new CreateObjectsCommand([survivor]));
    const deleted: PlanetView[] = [];

    for (let i = 0; i < 1000; i++) {
      const object = new PlanetView(i + 100, []);
      deleted.push(object);
      container.handleCommand(new CreateObjectsCommand([object]));
      calls(container, survivor.id, ['onShoot', 40]);
      container.handleCommand(new DeleteObjectsCommand([object.id]));
      snapshot(container, 5 + i * 0.04);

      expect(container.planets.length).toBeLessThanOrEqual(15);
      expect(retained(container).objects.size).toBeLessThanOrEqual(16);
      expect(retained(container).deleteAt.size).toBeLessThanOrEqual(15);
      expect(retained(container).remoteCalls.length).toBeLessThanOrEqual(15);
    }

    expect(deleted[0].beforeDestroy).toHaveBeenCalledOnce();
    expect(deleted[984].beforeDestroy).toHaveBeenCalledOnce();
    expect(survivor.onShoot).not.toHaveBeenCalled();

    serverTimeline.step(0);
    container.step(0);
    expect(survivor.onShoot).not.toHaveBeenCalled();
    expect(retained(container).remoteCalls.length).toBeLessThanOrEqual(3);

    // With no additional effects, subsequent snapshots retire the entire old tail.
    snapshot(container, 46);
    expect(container.planets).toHaveLength(0);
    expect(retained(container).objects.size).toBe(1);
    expect(retained(container).deleteAt.size).toBe(0);
    expect(retained(container).remoteCalls).toHaveLength(0);
    serverTimeline.step(0);
    container.step(0);
    expect(survivor.onShoot).not.toHaveBeenCalled();
  });

  it('preserves expired state silently and applies fresh health feedback in order', () => {
    const container = new GameObjectContainer({} as never);
    const object = character();
    container.handleCommand(new CreateObjectsCommand([object]));
    calls(container, object.id, ['setHealth', 80], ['setKillCount', 1], ['onShoot', 40]);
    snapshot(container, 5);
    calls(container, object.id, ['setHealth', 60], ['setKillCount', 2], ['onDie']);
    snapshot(container, 5.04);
    snapshot(container, 5.6);

    expect(object.health).toBe(60);
    expect(object.killCount).toBe(2);
    expect(object.setHealth).not.toHaveBeenCalled();
    expect(object.onShoot).not.toHaveBeenCalled();
    expect(object.onDie).not.toHaveBeenCalled();

    calls(container, object.id, ['setHealth', 40], ['setKillCount', 3], ['onShoot', 50]);
    snapshot(container, 5.7);
    serverTimeline.step(0);
    container.step(0);
    expect(object.health).toBe(60);
    expect(object.setHealth).not.toHaveBeenCalled();

    nowMs += 110;
    serverTimeline.step(0.11);
    container.step(0);
    expect(object.health).toBe(40);
    expect(object.killCount).toBe(3);
    expect(object.setHealth).toHaveBeenCalledExactlyOnceWith(40);
    expect(object.onShoot).toHaveBeenCalledExactlyOnceWith(50);
    expect(object.onDie).not.toHaveBeenCalled();
  });

  it('preserves final light and contested state while discarding transient planet effects', () => {
    const container = new GameObjectContainer({} as never);
    const object = Object.assign(new (class extends GameObject {})(1), {
      contested: false,
      lightness: 0,
      color: [0, 0, 0],
      step() {},
      render() {},
      setContested(value: boolean) {
        this.contested = value;
      },
      setLight(color: number[], lightness: number) {
        this.color = color;
        this.lightness = lightness;
      },
      onFlipped: vi.fn(),
      generatedPoints: vi.fn(),
    });
    container.handleCommand(new CreateObjectsCommand([object]));
    calls(
      container,
      object.id,
      ['setContested', true],
      ['setLight', [1, 0, 0], 2],
      ['onFlipped', CharacterTeam.red],
      ['generatedPoints', 10],
    );
    snapshot(container, 5);
    calls(
      container,
      object.id,
      ['setContested', false],
      ['setLight', [0, 0, 1], 3],
      ['onFlipped', CharacterTeam.blue],
      ['generatedPoints', 20],
    );
    snapshot(container, 5.04);
    snapshot(container, 6);

    expect(object.contested).toBe(false);
    expect(object.color).toEqual([0, 0, 1]);
    expect(object.lightness).toBe(3);
    expect(object.onFlipped).not.toHaveBeenCalled();
    expect(object.generatedPoints).not.toHaveBeenCalled();
    expect(retained(container).remoteCalls).toHaveLength(0);
  });

  it('releases effect references immediately when a paused view is replaced', () => {
    const container = new GameObjectContainer({} as never);
    let object = character();
    container.handleCommand(new CreateObjectsCommand([object]));
    snapshot(container, 5);

    for (let i = 0; i < 100; i++) {
      calls(container, object.id, ['onShoot', 40]);
      container.handleCommand(new DeleteObjectsCommand([object.id]));
      const replacement = character(object.id);
      container.handleCommand(new CreateObjectsCommand([replacement]));
      expect(object.beforeDestroy).toHaveBeenCalledOnce();
      expect(retained(container).remoteCalls).toHaveLength(0);
      expect(retained(container).objects.get(object.id)).toBe(replacement);
      object = replacement;
    }

    snapshot(container, 5.04);
    nowMs += 200;
    serverTimeline.step(0.2);
    container.step(0);
    expect(object.beforeDestroy).not.toHaveBeenCalled();
  });

  it('expires the last queued effects on resume even when snapshots also stopped', () => {
    const container = new GameObjectContainer({} as never);
    const object = character();
    container.handleCommand(new CreateObjectsCommand([object]));
    calls(container, object.id, ['setHealth', 20], ['setKillCount', 4], ['onShoot', 40]);
    snapshot(container, 5);

    nowMs += 10_000;
    serverTimeline.step(10);
    container.step(10);

    expect(object.health).toBe(20);
    expect(object.killCount).toBe(4);
    expect(object.setHealth).not.toHaveBeenCalled();
    expect(object.onShoot).not.toHaveBeenCalled();
    expect(retained(container).remoteCalls).toHaveLength(0);
  });

  it('releases a deleted local player reference without waiting for a frame', () => {
    const container = new GameObjectContainer({} as never);
    const object = character();
    container.handleCommand(new CreateObjectsCommand([object]));
    container.player = object as never;
    snapshot(container, 5);
    container.handleCommand(new DeleteObjectsCommand([object.id]));
    snapshot(container, 5.04);
    expect(container.localPlayer).toBe(object);

    snapshot(container, 6);
    expect(object.beforeDestroy).toHaveBeenCalledOnce();
    expect(container.player).toBeUndefined();
    expect(container.localPlayer).toBeUndefined();
    expect(retained(container).objects.size).toBe(0);
  });
});
