import { vec2 } from 'gl-matrix';
import { Random } from '../../helper/random';
import { settings } from '../../settings';
import { serializable } from '../../serialization/serializable';
import { toArrayFromFields } from '../../serialization/serialized-fields';
import { GameObject } from '../game-object';
import { Id } from '../../communication/id';
import { CharacterTeam } from './character-base';

@serializable
export class PlanetBase extends GameObject {
  // centre/radius are derived from vertices in the constructor, so they are not
  // serialized — only the constructor parameters are.
  private static readonly serializedFields = [
    'id',
    'vertices',
    'ownership',
    'isKeystone',
  ] as const;

  public readonly center: vec2;
  public readonly radius: number;

  constructor(
    id: Id,
    public readonly vertices: Array<vec2>,
    public ownership: number = 0.5,
    public readonly isKeystone: boolean = false,
  ) {
    super(id);
    this.center = vertices.reduce((sum, v) => vec2.add(sum, sum, v), vec2.create());
    vec2.scale(this.center, this.center, 1 / vertices.length);
    this.radius =
      vertices.reduce((sum, v) => sum + vec2.distance(this.center, v), 0) /
      this.vertices.length;
  }

  // Which team controls this planet, with the neutral dead-band around 50%
  // applied. Lives here so scoring (server) and every tint the player sees
  // (client) read one rule rather than three copies of the same comparison.
  public get team(): CharacterTeam {
    return Math.abs(this.ownership - 0.5) < settings.planetControlThreshold
      ? CharacterTeam.neutral
      : this.ownership < 0.5
        ? CharacterTeam.blue
        : CharacterTeam.red;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public generatedPoints(value: number) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onFlipped(team: CharacterTeam) {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setContested(contested: boolean) {}

  public static createPlanetVertices(
    center: vec2,
    width: number,
    height: number,
    randomness: number,
    vertexCount = settings.planetEdgeCount,
  ): Array<vec2> {
    const vertices = [];

    for (let i = 0; i < vertexCount; i++) {
      vertices.push(
        vec2.fromValues(
          center[0] +
            (width / 2) * Math.cos((i / vertexCount) * -Math.PI * 2) +
            Random.getRandomInRange(-randomness, randomness),
          center[1] +
            (height / 2) * Math.sin((i / vertexCount) * -Math.PI * 2) +
            Random.getRandomInRange(-randomness, randomness),
        ),
      );
    }
    return vertices;
  }

  public toArray(): Array<any> {
    return toArrayFromFields(this, PlanetBase.serializedFields);
  }
}
