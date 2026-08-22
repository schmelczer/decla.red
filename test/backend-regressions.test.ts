// Regression net for backend defects — drives the real classes.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

import { PhysicalContainer } from '../backend/src/physics/containers/physical-container';
import { BoundingBox } from '../backend/src/physics/bounding-boxes/bounding-box';
import { ProjectilePhysical } from '../backend/src/objects/projectile-physical';
import { CharacterPhysical } from '../backend/src/objects/character-physical';
import { StepCommand, GeneratePointsCommand } from '../backend/src/commands/commands';

const require = createRequire(import.meta.url);
const shared = require('../shared/lib/main.js');
const { vec2 } = require('../shared/node_modules/gl-matrix');
const { applyArrayPlugins, Random, settings, CharacterTeam } = shared;

applyArrayPlugins();

const step = settings.targetPhysicsDeltaTimeInSeconds;

class PointsSpy {
  public blue = 0;
  public red = 0;
  public handleCommand(command: unknown) {
    if (command instanceof GeneratePointsCommand) {
      this.blue += command.blue;
      this.red += command.red;
    }
  }
}

const boxAround = (center: number[], radius: number) => {
  const box = new BoundingBox();
  box.xMin = center[0] - radius;
  box.xMax = center[0] + radius;
  box.yMin = center[1] - radius;
  box.yMax = center[1] + radius;
  return box;
};

beforeEach(() => {
  Random.seed = 1;
});

describe('projectile broadphase registration', () => {
  it('follows the projectile instead of staying at the muzzle', () => {
    const container = new PhysicalContainer();
    container.initialize();

    const projectile = new ProjectilePhysical(
      vec2.fromValues(0, 0),
      20,
      40,
      CharacterTeam.blue,
      vec2.fromValues(3000, 0),
      { team: CharacterTeam.blue } as never,
      container,
      0,
    );
    container.addObject(projectile);

    for (let i = 0; i < 40; i++) {
      container.handleCommand(new StepCommand(step, new PointsSpy() as never));
    }

    expect(projectile.center[0]).toBeGreaterThan(400);
    expect(container.findIntersecting(boxAround(projectile.center, 100))).toContain(
      projectile,
    );
    expect(container.findIntersecting(boxAround([0, 0], 100))).not.toContain(projectile);
  });

  it('spawns a shot just clear of the shooter, not a jump downrange', () => {
    const container = new PhysicalContainer();
    container.initialize();
    const projectile = new ProjectilePhysical(
      vec2.fromValues(0, 0),
      20,
      40,
      CharacterTeam.blue,
      vec2.fromValues(3000, 0),
      { team: CharacterTeam.blue } as never,
      container,
      0,
    );

    expect(projectile.center[0]).toBeLessThanOrEqual(15);
  });
});

describe('scoring', () => {
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

  it('awards nothing for an administrative death', () => {
    const container = new PhysicalContainer();
    container.initialize();
    const character = spawnCharacter(container);
    const game = new PointsSpy();

    character.onDie(); // what PlayerBase.destroy() does on a socket drop
    container.handleCommand(new StepCommand(step, game as never));

    expect(game.blue).toBe(0);
    expect(game.red).toBe(0);
  });

  it('still awards a kill for a combat death', () => {
    const container = new PhysicalContainer();
    container.initialize();
    const character = spawnCharacter(container);
    const game = new PointsSpy();

    character.onDie(true);
    container.handleCommand(new StepCommand(step, game as never));

    expect(game.red).toBe(settings.playerKillPoint);
    expect(game.blue).toBe(0);
  });
});

describe('charged shots', () => {
  it('scales the shot by the strength actually paid, not the requested charge', () => {
    const container = new PhysicalContainer();
    container.initialize();
    const character = new CharacterPhysical(
      'tester',
      0,
      0,
      CharacterTeam.blue,
      container,
      vec2.fromValues(0, 0),
    );
    container.addObject(character);

    (character as unknown as { projectileStrength: number }).projectileStrength =
      settings.chargeShotStrengthMin;

    const before = container.findIntersecting(boxAround([0, 0], 5000)).length;
    character.shootTowards(vec2.fromValues(1000, 0), 1);
    const spawned = container
      .findIntersecting(boxAround([0, 0], 5000))
      .filter((o) => o.gameObject instanceof ProjectilePhysical)
      .map((o) => o.gameObject as ProjectilePhysical);

    expect(container.findIntersecting(boxAround([0, 0], 5000)).length).toBeGreaterThan(
      before,
    );
    expect(spawned[0].charge).toBeCloseTo(0, 5);
    expect(spawned[0].radius).toBeCloseTo(settings.chargeShotRadiusMin, 5);
  });

  it('ignores a shot aimed at the shooter itself', () => {
    const container = new PhysicalContainer();
    container.initialize();
    const character = new CharacterPhysical(
      'tester',
      0,
      0,
      CharacterTeam.blue,
      container,
      vec2.fromValues(0, 0),
    );
    container.addObject(character);

    const projectilesBefore = container
      .findIntersecting(boxAround([0, 0], 5000))
      .filter((o) => o.gameObject instanceof ProjectilePhysical).length;
    character.shootTowards(vec2.clone(character.center), 1);
    const projectilesAfter = container
      .findIntersecting(boxAround([0, 0], 5000))
      .filter((o) => o.gameObject instanceof ProjectilePhysical).length;

    expect(projectilesAfter).toBe(projectilesBefore);
  });
});
