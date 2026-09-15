import { vec2 } from 'gl-matrix';
import { Random } from '../../helper/random';
import { settings } from '../../settings';
import { serializable } from '../../serialization/serializable';
import { GameObject } from '../game-object';
import { Id } from '../../communication/communication';
import { CharacterTeam } from './character-base';
import { GroundSurface } from '../../physics/sdf';
import { planetDistance, planetGravity } from '../../physics/planet-sdf';

@serializable
export class PlanetBase extends GameObject implements GroundSurface {
  public readonly canCollide = true;
  public readonly isGround = true;
  public readonly center: vec2;
  public readonly radius: number;
  public angularVelocity = 0;

  private _rotation = 0;
  private cosRotation = 1;
  private sinRotation = 0;

  constructor(
    id: Id,
    public readonly vertices: Array<vec2>,
    public ownership: number = 0.5,
    public readonly isKeystone: boolean = false,
  ) {
    super(id);
    this.center = vec2.create();
    for (const vertex of vertices) {
      vec2.add(this.center, this.center, vertex);
    }
    vec2.scale(this.center, this.center, 1 / vertices.length);
    let totalRadius = 0;
    for (const vertex of vertices) {
      totalRadius += vec2.distance(this.center, vertex);
    }
    this.radius = totalRadius / vertices.length;
  }

  public get team(): CharacterTeam {
    return Math.abs(this.ownership - 0.5) < settings.planetControlThreshold
      ? CharacterTeam.neutral
      : this.ownership < 0.5
        ? CharacterTeam.blue
        : CharacterTeam.red;
  }

  public get rotation(): number {
    return this._rotation;
  }

  public set rotation(value: number) {
    this._rotation = value;
    this.cosRotation = Math.cos(value);
    this.sinRotation = Math.sin(value);
  }

  public advanceRotation(deltaTimeInSeconds: number) {
    this.rotation += this.angularVelocity * deltaTimeInSeconds;
  }

  public distance(target: vec2): number {
    return planetDistance(
      target,
      this.vertices,
      this.center,
      this.cosRotation,
      this.sinRotation,
    );
  }

  public gravityAt(position: vec2): vec2 {
    return planetGravity(this.center, this.radius, position);
  }

  public generatedPoints(_value: number) {}
  public onFlipped(_team: CharacterTeam) {}
  public setContested(_contested: boolean) {}

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
    return [this.id, this.vertices, this.ownership, this.isKeystone];
  }
}
