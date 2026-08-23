import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

import { PhysicalContainer } from '../backend/src/physics/physical-container';
import { BoundingBox } from '../backend/src/physics/bounding-box';
import { ProjectilePhysical } from '../backend/src/objects/projectile-physical';
import { CharacterPhysical } from '../backend/src/objects/character-physical';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');
const { Random, settings, CharacterTeam } = shared;

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
