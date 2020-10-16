import { vec2 } from 'gl-matrix';
import { Random } from '../../helper/random';
import { settings } from '../../settings';
import { Id } from '../../transport/identity';
import { serializable } from '../../transport/serialization/serializable';
import { GameObject } from '../game-object';

@serializable
export class PlanetBase extends GameObject {
  constructor(id: Id, public readonly vertices: Array<vec2>) {
    super(id);
  }

  public static createPlanetVertices(
    center: vec2,
    width: number,
    height: number,
    randomness: number,
    vertexCount = settings.polygonEdgeCount,
  ): Array<vec2> {
    const vertices = [];

    for (let i = 0; i < vertexCount; i++) {
      vertices.push(
        vec2.fromValues(
          center.x +
            (width / 2) * Math.cos((i / vertexCount) * -Math.PI * 2) +
            Random.getRandomInRange(-randomness, randomness),
          center.y +
            (height / 2) * Math.sin((i / vertexCount) * -Math.PI * 2) +
            Random.getRandomInRange(-randomness, randomness),
        ),
      );
    }
    return vertices;
  }

  public toArray(): Array<any> {
    return [this.id, this.vertices];
  }
}
