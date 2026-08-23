import { vec2 } from 'gl-matrix';
import {
  CommandReceiver,
  Circle,
  PlayerInformation,
  CharacterTeam,
  Random,
  settings,
  sanitizeName,
  boundRadius,
  evaluateSdf,
} from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { CharacterPhysical } from '../objects/character-physical';
import { PlanetPhysical } from '../objects/planet-physical';
import { PlayerContainer } from './player-container';

const maximumNameLength = 40;

export abstract class PlayerBase extends CommandReceiver {
  public character?: CharacterPhysical | null;
  public center: vec2 = vec2.create();

  protected sumKills = 0;
  protected sumDeaths = 0;
  protected timeUntilRespawn = 0;

  constructor(
    protected readonly playerInfo: PlayerInformation,
    protected readonly playerContainer: PlayerContainer,
    protected readonly objectContainer: PhysicalContainer,
    public readonly team: CharacterTeam,
  ) {
    super();
  }

  protected createCharacter() {
    this.character = new CharacterPhysical(
      // Coerce, don't just truncate: input is untrusted (from deserialize), and
      // arrays have `.slice()` too — a non-string name would throw inside the
      // reviver and kill the recipient's whole message batch.
      sanitizeName(this.playerInfo.name, maximumNameLength),
      this.sumKills,
      this.sumDeaths,
      this.team,
      this.objectContainer,
      this.findEmptyPositionForPlayer(this.findSpawnCenter()),
    );

    this.objectContainer.addObject(this.character);
  }

  public abstract step(deltaTimeInSeconds: number): void;

  /**
   * Shared death/respawn cycle. Returns the living character to act with this
   * tick (or undefined), so a subclass can use it directly without re-narrowing.
   */
  protected stepLifecycle(deltaTimeInSeconds: number): CharacterPhysical | undefined {
    if (this.character) {
      this.center = this.character.center;

      if (this.character.isAlive) {
        return this.character;
      }

      this.sumDeaths++;
      this.sumKills = this.character.killCount;
      this.onCharacterDied(this.character);
      this.character = null;
      this.timeUntilRespawn = settings.playerDiedTimeout;
      return undefined;
    }

    if ((this.timeUntilRespawn -= deltaTimeInSeconds) < 0) {
      this.onBeforeRespawn();
      this.createCharacter();
      this.center = this.character!.center;
    }
    return undefined;
  }

  // Override hooks (no-ops by default).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCharacterDied(character: CharacterPhysical) {}
  protected onBeforeRespawn() {}

  private findSpawnCenter(): vec2 {
    const planets = this.objectContainer
      .findIntersecting(
        getBoundingBoxOfCircle(new Circle(vec2.create(), settings.worldRadius * 2)),
      )
      .filter((o): o is PlanetPhysical => o instanceof PlanetPhysical);

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

    // candidates is non-empty here, so choose() always returns a planet.
    return vec2.clone(Random.choose(safe.length ? safe : candidates)!.center);
  }

  public restoreScore(kills: number, deaths: number) {
    this.sumKills = kills;
    this.sumDeaths = deaths;
  }

  protected findEmptyPositionForPlayer(preferredCenter: vec2): vec2 {
    let rotation = 0;
    let radius = 0;
    // preferredCenter is a planet centre, the single worst place to give up on:
    // depenetrateCircle only runs four passes, and a body left that deep inside
    // the rock registers a zero-distance hit every march and never moves again.
    // So the roomiest point the spiral saw is kept as the fallback instead.
    let roomiestPosition = vec2.clone(preferredCenter);
    let roomiestClearance = -Infinity;
    for (let attempt = 0; attempt < 512; attempt++) {
      const playerPosition = vec2.fromValues(
        radius * Math.cos(rotation) + preferredCenter.x,
        radius * Math.sin(rotation) + preferredCenter.y,
      );

      const playerBoundingCircle = new Circle(playerPosition, boundRadius);

      const playerBoundingBox = getBoundingBoxOfCircle(playerBoundingCircle);
      const possibleIntersectors =
        this.objectContainer.findIntersecting(playerBoundingBox);
      const clearance = evaluateSdf(playerBoundingCircle.center, possibleIntersectors);
      if (clearance >= playerBoundingCircle.radius) {
        return playerPosition;
      }
      if (clearance > roomiestClearance) {
        roomiestClearance = clearance;
        roomiestPosition = playerPosition;
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
