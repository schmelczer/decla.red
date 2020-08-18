import { GameObject } from './objects/game-object';
import { vec2 } from 'gl-matrix';
import { BoundingBoxBase } from './shapes/bounding-box-base';

export interface IGame {
  addObject(o: GameObject);
  readonly viewArea: BoundingBoxBase;
  findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase>;
}
