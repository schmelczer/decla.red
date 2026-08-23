import { vec2 } from 'gl-matrix';
import {
  CommandReceiver,
  PlayerInformation,
  CharacterTeam,
  Random,
  settings,
  sanitizeName,
  boundRadius,
  evaluateSdf,
} from 'shared';
import { PhysicalContainer } from '../physics/physical-container';
import { BoundingBox } from '../physics/bounding-box';
import { CharacterPhysical } from '../objects/character-physical';
import { PlanetPhysical, planetsIn } from '../objects/planet-physical';
import { PlayerContainer } from './player-container';

const maximumNameLength = 40;

export interface Score {
  kills: number;
  deaths: number;
}

export abstract class PlayerBase extends CommandReceiver {
  public character: CharacterPhysical | null = null;
  public center: vec2 = vec2.create();

  protected lastCharacter?: CharacterPhysical;
  protected timeUntilRespawn = 0;
  private kills: number;
  private deaths: number;

  constructor(
    protected readonly playerInfo: PlayerInformation,
    protected readonly playerContainer: PlayerContainer,
    protected readonly objectContainer: PhysicalContainer,
    public readonly team: CharacterTeam,
    score: Score = { kills: 0, deaths: 0 },
  ) {
    super();
    this.kills = score.kills;
    this.deaths = score.deaths;
  }

  public get score(): Score {
    return {
      kills: (this.character ?? this.lastCharacter)?.killCount ?? this.kills,
      deaths: this.deaths,
    };
  }

  protected createCharacter(): CharacterPhysical {
    this.kills = this.lastCharacter?.killCount ?? this.kills;
    this.character = new CharacterPhysical(
      sanitizeName(this.playerInfo.name, maximumNameLength),
      this.kills,
      this.deaths,
      this.team,
      this.objectContainer,
      this.findEmptyPositionForPlayer(this.findSpawnCenter()),
    );
    this.objectContainer.addObject(this.character);
    this.center = this.character.center;
    return this.character;
  }

  public abstract step(deltaTimeInSeconds: number): void;

  protected stepLifecycle(deltaTimeInSeconds: number): CharacterPhysical | undefined {
    if (this.character) {
      this.center = this.character.center;

      if (this.character.isAlive) {
        return this.character;
      }

      this.deaths++;
      this.lastCharacter = this.character;
      this.character = null;
      this.timeUntilRespawn = settings.playerDiedTimeout;
      return undefined;
    }

    if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
      this.createCharacter();
    }
    return undefined;
  }

  private findSpawnCenter(): vec2 {
    const planets = planetsIn(
      this.objectContainer.findIntersecting(
        BoundingBox.ofCircle(vec2.create(), settings.worldRadius * 2),
      ),
    );

    const friendly = planets.filter((p) => p.team === this.team);
    const neutral = planets.filter((p) => p.team === CharacterTeam.neutral);
    const candidates = friendly.length ? friendly : neutral.length ? neutral : planets;
    if (candidates.length === 0) {
      return vec2.create();
    }

    const isContested = (planet: PlanetPhysical) =>
      this.playerContainer.players.some(
        (p) =>
          p.team !== this.team &&
          p.character?.isAlive &&
          vec2.distance(p.center, planet.center) < settings.spawnSafetyDistance,
      );
    const safe = candidates.filter((p) => !isContested(p));

    return vec2.clone(Random.choose(safe.length ? safe : candidates)!.center);
  }

  private findEmptyPositionForPlayer(preferredCenter: vec2): vec2 {
    let rotation = 0;
    let radius = 0;
    let roomiestPosition = vec2.clone(preferredCenter);
    let roomiestClearance = -Infinity;
    for (let attempt = 0; attempt < 512; attempt++) {
      const position = vec2.fromValues(
        radius * Math.cos(rotation) + preferredCenter[0],
        radius * Math.sin(rotation) + preferredCenter[1],
      );

      const clearance = evaluateSdf(
        position,
        this.objectContainer.findIntersecting(
          BoundingBox.ofCircle(position, boundRadius),
        ),
      );
      if (clearance >= boundRadius) {
        return position;
      }
      if (clearance > roomiestClearance) {
        roomiestClearance = clearance;
        roomiestPosition = position;
      }

      rotation += Math.PI / 8;
      radius += 30;
    }

    return roomiestPosition;
  }

  public destroy() {
    this.character?.onDie();
  }
}
