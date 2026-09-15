import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

import { PhysicalContainer } from '../backend/src/physics/physical-container';
import { BoundingBox } from '../backend/src/physics/bounding-box';
import { ProjectilePhysical } from '../backend/src/objects/projectile-physical';
import { CharacterPhysical } from '../backend/src/objects/character-physical';
import { PlanetPhysical } from '../backend/src/objects/planet-physical';
import { PlayerContainer } from '../backend/src/players/player-container';
import { defaultOptions } from '../backend/src/options';
import { GameServer } from '../backend/src/game-server';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');
const {
  Random,
  settings,
  CharacterTeam,
  SetAspectRatioActionCommand,
  TransportEvents,
  deserialize,
  CreateObjectsCommand,
  PropertyUpdatesForObjects,
  InputAcknowledgement,
  LeapActionCommand,
  calculateViewArea,
} = shared;

const step = settings.targetPhysicsDeltaTimeInSeconds;

class PointsSpy {
  public blue = 0;
  public red = 0;
  public addPoints(blue: number, red: number) {
    this.blue += blue;
    this.red += red;
  }
  public announce() {}
}

const makeWorld = () => {
  const game = new PointsSpy();
  return { game, container: new PhysicalContainer(game) };
};

const spawnProjectile = (container: PhysicalContainer) =>
  new ProjectilePhysical(
    vec2.fromValues(0, 0),
    20,
    40,
    CharacterTeam.blue,
    vec2.fromValues(3000, 0),
    { team: CharacterTeam.blue } as never,
    container,
    0,
  );

const spawnCharacter = (container: PhysicalContainer) => {
  const character = new CharacterPhysical(
    'tester',
    0,
    0,
    CharacterTeam.blue,
    container,
    vec2.fromValues(0, 0),
  );
  container.addObject(character);
  return character;
};

const projectilesIn = (container: PhysicalContainer) =>
  container
    .findIntersecting(BoundingBox.ofCircle([0, 0], 5000))
    .filter((o) => o.gameObject instanceof ProjectilePhysical)
    .map((o) => o.gameObject as ProjectilePhysical);

beforeEach(() => {
  Random.seed = 1;
});

it('credits posthumous kills without making a corpse appear alive to clients', () => {
  const { container } = makeWorld();
  const character = spawnCharacter(container);
  character.setHealth(0);
  character.onDie();
  character.addKill('late projectile victim');

  expect(character.killCount).toBe(1);
  expect(character.health).toBe(0);
  expect(
    character.getRemoteCalls().some((call) => call.functionName === 'setHealth'),
  ).toBe(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const controlledServer = () => {
  let nowMs = 1000;
  let nextTick: () => void = () => {};
  vi.spyOn(process.hrtime, 'bigint').mockImplementation(() => BigInt(nowMs * 1e6));
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
    nextTick = callback;
    return 0;
  }) as never);
  const server = new GameServer(
    {
      on() {},
      to() {
        return { emit() {} };
      },
    } as never,
    {
      ...defaultOptions,
      npcCount: 0,
    },
  );
  const internals = server as unknown as {
    players: PlayerContainer;
    objects: PhysicalContainer;
    isInEndGame: boolean;
  };
  server.start();
  return {
    players: internals.players,
    objects: internals.objects,
    server,
    tick(milliseconds: number) {
      nowMs += milliseconds;
      nextTick();
    },
  };
};

describe('server snapshot cadence', () => {
  it('waits for physics before acknowledging input or clearing remote calls', () => {
    const { players, objects, tick } = controlledServer();
    const communicate = vi.spyOn(players, 'stepCommunication');
    const character = spawnCharacter(objects);
    character.shootTowards(vec2.fromValues(1000, 0));

    tick(1);

    expect(communicate).not.toHaveBeenCalled();
    expect(
      character.getRemoteCalls().some((call) => call.functionName === 'onShoot'),
    ).toBe(true);

    tick(4);

    expect(communicate).toHaveBeenCalledOnce();
    expect(character.getRemoteCalls()).toHaveLength(0);
  });

  it.each([false, true])(
    'sends 25 snapshots per simulated second (endgame: %s)',
    (endGame) => {
      const { players, server, tick } = controlledServer();
      (server as unknown as { isInEndGame: boolean }).isInEndGame = endGame;
      const batches: unknown[] = [];
      const player = players.createPlayer({ name: 'player' }, {
        on() {},
        emit(event: string, batch: unknown) {
          if (event === TransportEvents.ServerToPlayer) {
            batches.push(batch);
          }
        },
      } as never);

      for (let i = 0; i < 200; i++) {
        tick(5);
      }

      expect(batches).toHaveLength(25);
      const snapshot = deserialize(batches[24] as string).find(
        (command: object) => command instanceof PropertyUpdatesForObjects,
      );
      const character = snapshot.updates.find(
        (object: { id: number }) => object.id === player.character!.id,
      );
      const strength = character.updates.find(
        (update: { propertyKey: string }) => update.propertyKey === 'strength',
      );
      expect(strength.rateOfChange).toBeCloseTo(
        settings.playerStrengthRegenerationPerSeconds * (endGame ? 0.5 : 1),
      );
    },
  );
});

describe('slow-motion extrapolation', () => {
  const wallDelta = step;
  const timeScale = 0.25;

  it('coasts projectiles at the same speed as the slowed server without changing momentum', () => {
    const { container } = makeWorld();
    const projectile = spawnProjectile(container);
    const before = vec2.clone(projectile.center);
    projectile.step(wallDelta * timeScale);
    const update = projectile.getPropertyUpdates(timeScale).updates[0];

    expect(
      vec2.scaleAndAdd(vec2.create(), before, update.rateOfChange, wallDelta),
    ).toEqual(projectile.center);
    expect(projectile.object.velocity).toEqual([3000, 0]);
    const strength = projectile
      .getPropertyUpdates(timeScale)
      .updates.find((property) => property.propertyKey === 'strength')!;
    expect(40 + strength.rateOfChange * wallDelta).toBeCloseTo(projectile.strength);
    expect(strength.propertyValue).toBe(projectile.strength);
  });

  it('coasts planet rotation using wall-clock seconds', () => {
    const { game } = makeWorld();
    const planet = new PlanetPhysical(
      [
        [-100, -100],
        [-100, 100],
        [100, 100],
        [100, -100],
      ],
      false,
      game,
    );
    const angularVelocity = planet.angularVelocity;
    planet.step(wallDelta * timeScale);
    const update = planet
      .getPropertyUpdates(timeScale)
      .updates.find((property) => property.propertyKey === 'rotation')!;

    expect(update.rateOfChange * wallDelta).toBeCloseTo(planet.rotation);
    expect(planet.angularVelocity).toBe(angularVelocity);
  });

  it('scales character pose derivatives without mutating the stored simulation rates', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);
    character.step(settings.spawnDespawnTime + step);
    character.setMoveDirection(vec2.fromValues(1, 0));
    vec2.set(character.bodyVelocity, 1000, 0);
    const parts = [character.head, character.leftFoot, character.rightFoot];
    const before = parts.map((part) => vec2.clone(part.center));
    character.step(wallDelta * timeScale);
    const originalRates = character.getPropertyUpdates();
    const slowedRates = character.getPropertyUpdates(timeScale);

    parts.forEach((part, i) => {
      const rate = slowedRates.updates[i].rateOfChange;
      expect(vec2.scaleAndAdd(vec2.create(), before[i], rate.center, wallDelta)).toEqual(
        part.center,
      );
    });
    expect(character.getPropertyUpdates()).toEqual(originalRates);
  });

  it('coasts spawn growth using the slowed radius derivative', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);
    character.step(0.1);
    const before = character.head.radius;
    character.step(wallDelta * timeScale);
    const radiusSpeed =
      character.getPropertyUpdates(timeScale).updates[0].rateOfChange.radius;

    expect(before + radiusSpeed * wallDelta).toBeCloseTo(character.head.radius);
  });
});

describe('projectile broadphase registration', () => {
  it('follows the projectile instead of staying at the muzzle', () => {
    const { container } = makeWorld();
    const projectile = spawnProjectile(container);
    container.addObject(projectile);

    for (let i = 0; i < 40; i++) {
      container.step(step);
    }

    expect(projectile.center[0]).toBeGreaterThan(400);
    expect(
      container.findIntersecting(BoundingBox.ofCircle(projectile.center, 100)),
    ).toContain(projectile);
    expect(container.findIntersecting(BoundingBox.ofCircle([0, 0], 100))).not.toContain(
      projectile,
    );
  });

  it('spawns a shot just clear of the shooter, not a jump downrange', () => {
    const { container } = makeWorld();
    const projectile = spawnProjectile(container);

    expect(projectile.center[0]).toBeLessThanOrEqual(15);
  });

  it('does not advance a projectile destroyed earlier in the same world step', () => {
    const { container } = makeWorld();
    const projectile = spawnProjectile(container);
    const before = vec2.clone(projectile.center);
    const character = spawnCharacter(container);
    character.step = () => projectile.destroy();
    container.addObject(projectile);

    container.step(step);

    expect(projectile.center).toEqual(before);
    expect(projectile.strength).toBe(40);
  });
});

describe('authoritative held movement', () => {
  it('distinguishes no leap from an attempted leap timestamped at zero', () => {
    const { container } = makeWorld();
    const players = new PlayerContainer(container, 1, 0);
    const batches: string[] = [];
    const player = players.createPlayer({ name: 'player' }, {
      on() {},
      emit(event: string, payload: string) {
        if (event === TransportEvents.ServerToPlayer) {
          batches.push(payload);
        }
      },
    } as never);
    const sendSnapshot = () =>
      player.stepCommunications(settings.updateMessageInterval, 1000, (object) =>
        object.getPropertyUpdates(),
      );
    const leapAck = () =>
      deserialize(batches[batches.length - 1]).find(
        (command: object) => command instanceof InputAcknowledgement,
      ).lastLeapClientTimeMs;

    sendSnapshot();
    expect(leapAck()).toBe(-1);

    player.handleCommand(new LeapActionCommand(0));
    sendSnapshot();
    expect(leapAck()).toBe(0);
  });

  it('applies the latest direction when press and release arrive in the same tick', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);
    character.step(settings.spawnDespawnTime + step);
    const before = vec2.clone(character.center);

    character.setMoveDirection(vec2.fromValues(1, 0));
    character.setMoveDirection(vec2.fromValues(0, 0));
    character.step(step);

    expect(character.center).toEqual(before);
  });

  it('uses the latest held direction for a leap received in the same batch', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);
    character.step(settings.spawnDespawnTime + step);
    character.currentPlanet = {
      center: vec2.fromValues(0, -100),
      angularVelocity: 0,
    } as never;

    character.setMoveDirection(vec2.fromValues(1, 0));
    character.leap();

    expect(character.bodyVelocity[0]).toBeGreaterThan(0);
    expect(character.movementSnapshot.leapCooldownRemaining).toBeCloseTo(
      settings.leapCooldownSeconds,
    );
    character.step(step);
    expect(character.movementSnapshot.leapCooldownRemaining).toBeCloseTo(
      settings.leapCooldownSeconds - step,
    );
  });
});

describe('planets', () => {
  it('does not capture using a character killed after registering its presence', () => {
    const { container, game } = makeWorld();
    const character = spawnCharacter(container);
    const planet = new PlanetPhysical(
      [
        [-100, -100],
        [-100, 100],
        [100, 100],
        [100, -100],
      ],
      false,
      game,
    );
    planet.registerPresence(character);
    character.onDie();

    planet.step(step);

    expect(planet.ownership).toBe(0.5);
  });

  it.each([
    { aspect: 8, center: [0, 750] },
    { aspect: 0.2, center: [750, 0] },
  ])('sends offscreen gravity sources at aspect $aspect', ({ aspect, center }) => {
    const { container, game } = makeWorld();
    const batches: string[] = [];
    const socket = {
      on() {},
      emit(event: string, payload: string) {
        if (event === TransportEvents.ServerToPlayer) {
          batches.push(payload);
        }
      },
    };
    const players = new PlayerContainer(container, 1, 0);
    const player = players.createPlayer({ name: 'player' }, socket as never);
    const [x, y] = center;
    const planet = new PlanetPhysical(
      [
        [x - 20, y - 20],
        [x - 20, y + 20],
        [x + 20, y + 20],
        [x + 20, y - 20],
      ],
      false,
      game,
    );
    container.addObject(planet);
    player.handleCommand(new SetAspectRatioActionCommand(aspect));
    const { topLeft, size } = calculateViewArea(player.center, aspect, 1.2);
    expect(
      planet.boundingBox.intersects(
        new BoundingBox(
          topLeft[0],
          topLeft[0] + size[0],
          topLeft[1] - size[1],
          topLeft[1],
        ),
      ),
    ).toBe(false);

    player.stepCommunications(settings.updateMessageInterval + step, 1000, (object) =>
      object.getPropertyUpdates(),
    );

    const created = deserialize(batches[0]).find(
      (command: object) => command instanceof CreateObjectsCommand,
    );
    expect(created.objects.map((object: { id: number }) => object.id)).toContain(
      planet.id,
    );
  });
});

it('uses an integer default seed so separate server runs can generate different worlds', () => {
  expect(Number.isInteger(defaultOptions.seed)).toBe(true);
  expect(defaultOptions.seed).toBeGreaterThanOrEqual(0);
  expect(defaultOptions.seed).toBeLessThan(0x100000000);
});

describe('scoring', () => {
  it('awards nothing for an administrative death', () => {
    const { game, container } = makeWorld();
    const character = spawnCharacter(container);

    character.onDie();
    container.step(step);

    expect(game.blue).toBe(0);
    expect(game.red).toBe(0);
  });

  it('still awards a kill for a combat death', () => {
    const { game, container } = makeWorld();
    const character = spawnCharacter(container);

    character.onDie(true);
    container.step(step);

    expect(game.red).toBe(settings.playerKillPoint);
    expect(game.blue).toBe(0);
  });

  it('awards a combat death only once', () => {
    const { game, container } = makeWorld();
    const character = spawnCharacter(container);

    character.onDie(true);
    character.onDie(true);

    expect(game.red).toBe(settings.playerKillPoint);
  });
});

describe('NPC population', () => {
  it('replaces a departing human without adding extra bots for humans still playing', () => {
    const { container } = makeWorld();
    const players = new PlayerContainer(container, 16, 4);
    const socket = { on() {} } as never;
    const first = players.createPlayer({ name: 'first' }, socket);
    players.createPlayer({ name: 'second' }, socket);
    expect(players.players).toHaveLength(4);

    first.destroy();
    players.deletePlayer(first);

    expect(players.count).toBe(1);
    expect(players.players).toHaveLength(4);
  });
});

describe('charged shots', () => {
  it('scales the shot by the strength actually paid, not the requested charge', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);
    (character as unknown as { projectileStrength: number }).projectileStrength =
      settings.chargeShotStrengthMin;

    character.shootTowards(vec2.fromValues(1000, 0), 1);
    const [spawned] = projectilesIn(container);

    expect(spawned).toBeDefined();
    expect(spawned.charge).toBeCloseTo(0, 5);
    expect(spawned.radius).toBeCloseTo(settings.chargeShotRadiusMin, 5);
  });

  it('ignores a shot aimed at the shooter itself', () => {
    const { container } = makeWorld();
    const character = spawnCharacter(container);

    character.shootTowards(vec2.clone(character.center), 1);

    expect(projectilesIn(container)).toHaveLength(0);
  });
});
