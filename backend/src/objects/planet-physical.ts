import { vec2 } from 'gl-matrix';
import {
  clamp01,
  id,
  mix,
  Random,
  settings,
  PlanetBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
} from 'shared';
import { addPointsForTeam, GameEvents } from '../game-events';
import { BoundingBox } from '../physics/bounding-box';
import { Physical } from '../physics/physical';
import { PhysicalContainer } from '../physics/physical-container';
import { LampPhysical } from './lamp-physical';
import type { CharacterPhysical } from './character-physical';

export const planetsIn = (objects: Array<Physical>): Array<PlanetPhysical> =>
  objects.filter((o): o is PlanetPhysical => o instanceof PlanetPhysical);

export const planetsNear = (
  container: PhysicalContainer,
  center: vec2,
  radius: number,
): Array<PlanetPhysical> =>
  planetsIn(container.findIntersecting(BoundingBox.ofCircle(center, radius)));

export class PlanetPhysical extends PlanetBase implements Physical {
  public readonly boundingBox: BoundingBox;
  public readonly sizePointMultiplier: number;

  private readonly lamps: Array<LampPhysical> = [];
  private lastTeam: CharacterTeam = CharacterTeam.neutral;
  private presentCharacters: Array<CharacterPhysical> = [];
  private isContested = false;
  private timeSinceLastPointGeneration = 0;

  constructor(
    vertices: Array<vec2>,
    isKeystone: boolean,
    private readonly game: GameEvents,
  ) {
    super(id(), vertices, 0.5, isKeystone);

    const sizeClass = clamp01(
      (this.radius - settings.planetMinReferenceRadius) /
        (settings.planetMaxReferenceRadius - settings.planetMinReferenceRadius),
    );
    this.sizePointMultiplier = mix(1, settings.planetSizePointMultiplierMax, sizeClass);
    this.angularVelocity =
      (0.05 + Random.getRandom() * 0.07) * (Random.getRandom() < 0.5 ? -1 : 1);
    this.boundingBox = BoundingBox.ofCircle(
      this.center,
      Math.max(...vertices.map((v) => vec2.distance(this.center, v))),
    );
  }

  public get gameObject(): this {
    return this;
  }

  public addLamp(lamp: LampPhysical) {
    this.lamps.push(lamp);
  }

  public registerPresence(character: CharacterPhysical) {
    this.presentCharacters.push(character);
  }

  public step(deltaTimeInSeconds: number) {
    this.advanceRotation(deltaTimeInSeconds);
    this.timeSinceLastPointGeneration += deltaTimeInSeconds;

    this.generatePoints();
    this.resolveCapture(deltaTimeInSeconds);
    this.detectFlip();

    this.presentCharacters.length = 0;
  }

  private generatePoints() {
    if (this.timeSinceLastPointGeneration > settings.planetPointGenerationInterval) {
      this.timeSinceLastPointGeneration = 0;
      this.awardToOwner(settings.planetPointGenerationValue);
    }
  }

  private awardToOwner(base: number) {
    addPointsForTeam(this.game, this.team, Math.round(base * this.sizePointMultiplier));
  }

  private resolveCapture(deltaTime: number) {
    let blue = 0;
    let red = 0;
    for (const c of this.presentCharacters) {
      if (!c.isAlive) {
        continue;
      }
      if (c.team === CharacterTeam.blue) {
        blue++;
      } else if (c.team === CharacterTeam.red) {
        red++;
      }
    }
    const net = red - blue;
    const occupied = blue + red > 0;

    if (net !== 0) {
      const lead = Math.min(Math.abs(net), settings.maxContestLeadMultiplier);
      this.takeControl(
        net > 0 ? CharacterTeam.red : CharacterTeam.blue,
        deltaTime * lead,
      );
    } else if (!occupied) {
      this.takeControl(
        CharacterTeam.neutral,
        this.isKeystone ? deltaTime / settings.keystoneLoseControlScale : deltaTime,
      );
    }

    const contested = occupied && net === 0;
    if (contested !== this.isContested) {
      this.isContested = contested;
      this.remoteCall('setContested', contested);
    }
  }

  private detectFlip() {
    const currentTeam = this.team;
    if (currentTeam === this.lastTeam) {
      return;
    }
    this.lastTeam = currentTeam;

    if (currentTeam !== CharacterTeam.neutral) {
      this.remoteCall(
        'generatedPoints',
        Math.round(settings.captureFlipPointReward * this.sizePointMultiplier),
      );
      this.awardToOwner(settings.captureFlipPointReward);

      if (this.isKeystone) {
        this.game.announce(
          `Team <span class="${currentTeam}">${currentTeam}</span> captured the Heart`,
        );
      }
    }

    const control = Math.abs(this.ownership - 0.5) / 0.5;
    const lightness = mix(settings.lampMinLightness, settings.lampMaxLightness, control);
    const color = settings.palette[settings.colorIndices[currentTeam]];
    this.lamps.forEach((lamp) => lamp.queueSetLight(color, lightness));

    this.remoteCall('onFlipped', currentTeam);
  }

  private takeControl(team: CharacterTeam, deltaTime: number) {
    if (team === CharacterTeam.blue) {
      this.ownership -= (0.5 / settings.takeControlTimeInSeconds) * deltaTime;
    } else if (team === CharacterTeam.red) {
      this.ownership += (0.5 / settings.takeControlTimeInSeconds) * deltaTime;
    } else {
      const previous = this.ownership;
      this.ownership +=
        -Math.sign(this.ownership - 0.5) *
        (0.5 / settings.loseControlTimeInSeconds) *
        deltaTime;
      if ((previous - 0.5) * (this.ownership - 0.5) < 0) {
        this.ownership = 0.5;
      }
    }

    this.ownership = clamp01(this.ownership);
  }

  public getPropertyUpdates(timeScale = 1): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('ownership', this.ownership, 0),
      new UpdatePropertyCommand(
        'rotation',
        this.rotation,
        this.angularVelocity * timeScale,
      ),
    ]);
  }
}
