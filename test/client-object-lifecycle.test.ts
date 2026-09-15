import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const {
  CreateObjectsCommand,
  DeleteObjectsCommand,
  PropertyUpdatesForObjects,
  RemoteCallsForObjects,
  RemoteCallsForObject,
  RemoteCall,
  UpdatePropertyCommand,
  CharacterTeam,
} = createRequire(import.meta.url)('../shared/lib/main.js');
import { GameObjectContainer } from '../frontend/src/scripts/objects/game-object-container';
import { PlanetView } from '../frontend/src/scripts/objects/types/planet-view';
import { serverTimeline } from '../frontend/src/scripts/helper/server-timeline';
import { LinearInterpolator } from '../frontend/src/scripts/helper/interpolators/linear-interpolator';
import { ProjectileView } from '../frontend/src/scripts/objects/types/projectile-view';

vi.mock('../frontend/node_modules/sdf-2d', () => ({
  CircleLight: class {
    constructor(
      public center: number[],
      public color: number[],
      public intensity: number,
    ) {}
  },
}));

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
vi.mock('../frontend/src/scripts/feedback-hud', () => ({ FeedbackHud: {} }));

let nowMs = 0;
beforeEach(() => {
  nowMs = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  serverTimeline.reset();
});

describe('remote effects', () => {
  it('plays remote effects on the render timeline and local feedback immediately', () => {
    const container = new GameObjectContainer({} as never);
    const remote = new PlanetView(1, []);
    const local = {
      id: 2,
      health: 100,
      position: [0, 0],
      snapshotStrength: 80,
      step() {},
      processRemoteCalls: vi.fn(),
    };
    container.handleCommand(new CreateObjectsCommand([remote, local]));
    container.player = local as never;
    const calls = [new RemoteCall('onShoot', [40])];
    container.handleCommand(
      new RemoteCallsForObjects([
        new RemoteCallsForObject(remote.id, calls),
        new RemoteCallsForObject(local.id, calls),
      ]),
    );
    container.handleCommand(new PropertyUpdatesForObjects([], 5));
    expect(local.processRemoteCalls).toHaveBeenCalledWith(calls);
    step(0);
    container.step(0);
    expect(remote.processRemoteCalls).not.toHaveBeenCalled();
    step(0.11);
    container.step(0);
    expect(remote.processRemoteCalls).toHaveBeenCalledWith(calls);
  });

  it('discards queued effects when a view is replaced or the game resets', () => {
    const container = new GameObjectContainer({} as never);
    const original = new PlanetView(1, []);
    container.handleCommand(new CreateObjectsCommand([original]));
    container.handleCommand(
      new RemoteCallsForObjects([
        new RemoteCallsForObject(1, [new RemoteCall('onFlipped', ['red'])]),
      ]),
    );
    container.handleCommand(new PropertyUpdatesForObjects([], 5));
    const replacement = new PlanetView(1, []);
    container.handleCommand(new CreateObjectsCommand([replacement]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5.04));
    step(0.3);
    container.step(0);
    expect(original.processRemoteCalls).not.toHaveBeenCalled();
    expect(replacement.processRemoteCalls).not.toHaveBeenCalled();

    container.handleCommand(
      new RemoteCallsForObjects([
        new RemoteCallsForObject(1, [new RemoteCall('onFlipped', ['blue'])]),
      ]),
    );
    container.reset();
    container.step(0);
    expect(replacement.processRemoteCalls).not.toHaveBeenCalled();
  });
});
afterEach(() => vi.restoreAllMocks());

const step = (deltaSeconds: number) => {
  nowMs += deltaSeconds * 1000;
  serverTimeline.step(deltaSeconds);
};

describe('snapshot object lifetime', () => {
  it('keeps creation and deletion aligned with the delayed render timeline', () => {
    const container = new GameObjectContainer({} as never);
    const planet = new PlanetView(1, []);
    container.handleCommand(new CreateObjectsCommand([planet]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5));
    step(0);
    container.render({} as never, {} as never, true);
    expect(planet.render).not.toHaveBeenCalled();

    step(0.11);
    container.render({} as never, {} as never, true);
    expect(planet.render).toHaveBeenCalledOnce();

    container.handleCommand(new DeleteObjectsCommand([1]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5.2));
    container.step(0);
    expect(planet.beforeDestroy).not.toHaveBeenCalled();
    step(0.3);
    container.step(0);
    expect(planet.beforeDestroy).toHaveBeenCalledOnce();
    expect(container.planets).toHaveLength(0);
  });

  it('does not delete a replacement when an object re-enters before delayed retirement', () => {
    const container = new GameObjectContainer({} as never);
    const original = new PlanetView(1, []);
    container.handleCommand(new CreateObjectsCommand([original]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5));
    step(0);
    container.handleCommand(new DeleteObjectsCommand([1]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5.04));

    const replacement = new PlanetView(1, []);
    container.handleCommand(new CreateObjectsCommand([replacement]));
    container.handleCommand(new PropertyUpdatesForObjects([], 5.08));
    step(0.3);
    container.step(0);
    container.render({} as never, {} as never, true);

    expect(original.beforeDestroy).toHaveBeenCalledOnce();
    expect(replacement.beforeDestroy).not.toHaveBeenCalled();
    expect(replacement.render).toHaveBeenCalledOnce();
    expect(container.planets).toEqual([replacement]);
  });
});

describe('remote render timeline', () => {
  it('samples projectile strength on the server timeline, including slowed fading', () => {
    const projectile = new ProjectileView(1, [0, 0] as never, 10, CharacterTeam.red, 100);
    serverTimeline.onSnapshot(5);
    projectile.updateProperty(new UpdatePropertyCommand('strength', 100, -10));
    serverTimeline.onSnapshot(5.2);
    projectile.updateProperty(new UpdatePropertyCommand('strength', 98, -10));
    step(0);
    projectile.step(2);
    expect(projectile.strength).toBeCloseTo(99, 6);
    expect([...projectile.center]).toEqual([0, 0]);
  });

  it('does not accumulate an extra frame of lead while chasing its target', () => {
    serverTimeline.onSnapshot(10);
    step(0);
    for (let i = 0; i < 600; i++) step(1 / 60);
    expect(serverTimeline.renderTime).toBeCloseTo(19.9, 8);
  });

  it('interpolates positions and bounds extrapolation while snapshots are missing', () => {
    const position = new LinearInterpolator(0);
    serverTimeline.onSnapshot(10);
    position.addFrame(0, 100);
    serverTimeline.onSnapshot(10.1);
    position.addFrame(10, 100);
    step(0);
    step(0.05);
    expect(position.getValue(0.05)).toBeCloseTo(5, 6);
    step(0.4);
    expect(position.getValue(0.4)).toBeCloseTo(16, 6);
  });

  it('ages a new snapshot from its arrival, not the beginning of the render frame', () => {
    nowMs = 15;
    serverTimeline.onSnapshot(10);
    nowMs = 16;
    serverTimeline.step(0.016);
    expect(serverTimeline.renderTime).toBeCloseTo(9.901, 6);
  });
});
