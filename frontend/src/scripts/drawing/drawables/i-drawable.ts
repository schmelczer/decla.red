import { vec2 } from 'gl-matrix';
import { ImmutableBoundingBox } from '../../physics/containers/immutable-bounding-box';
import { GameObject } from '../../objects/game-object';

export interface IDrawable {
  serializeToUniforms(uniforms: any): void;
  distance(target: vec2): number;
  minimumDistance(target: vec2): number;
  readonly owner: GameObject;
  readonly boundingBox: ImmutableBoundingBox;
}
