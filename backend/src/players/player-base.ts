import { vec2 } from 'gl-matrix';
import {
  CommandReceiver,
  Circle,
  PlayerInformation,
  CharacterTeam,
  Random,
  settings,
  sanitizeName,
} from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { isCircleIntersecting } from '../physics/functions/is-circle-intersecting';
import { CharacterPhysical } from '../objects/character-physical';
import { PlanetPhysical } from '../objects/planet-physical';
import { PlayerContainer } from './player-container';

const maximumNameLength = 40;

export abstract class PlayerBase extends CommandReceiver {
  public character?: CharacterPhysical | null;
  public center: vec2 = vec2.create();

  protected sumKills = 0;
  protected sumDeaths = 0;

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
      // Coerced, not just truncated. `.slice()` also exists on arrays, so a
      // name that is an array passed straight through, was serialized into
      // CreateObjects, and was revived as a class on every peer that received
      // it — throwing inside the deserializer's reviver and killing that
      // client's whole message batch.
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

  // Seed a reconnecting player with the score it held before the drop, so a
  // network blip costs you your character but not your match.
  public restoreScore(kills: number, deaths: number) {
    this.sumKills = kills;
    this.sumDeaths = deaths;
  }

  protected findEmptyPositionForPlayer(preferredCenter: vec2): vec2 {
    let rotation = 0;
    let radius = 0;
    for (let attempt = 0; attempt < 512; attempt++) {
      const playerPosition = vec2.fromValues(
        radius * Math.cos(rotation) + preferredCenter.x,
        radius * Math.sin(rotation) + preferredCenter.y,
      );

      const playerBoundingCircle = new Circle(
        playerPosition,
        CharacterPhysical.boundRadius,
      );

      const playerBoundingBox = getBoundingBoxOfCircle(playerBoundingCircle);
      const possibleIntersectors =
        this.objectContainer.findIntersecting(playerBoundingBox);
      if (!isCircleIntersecting(playerBoundingCircle, possibleIntersectors)) {
        return playerPosition;
      }

      rotation += Math.PI / 8;
      radius += 30;
    }

    return vec2.clone(preferredCenter);
  }

  public destroy() {
    this.character?.onDie();
  }
}
