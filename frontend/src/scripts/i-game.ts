import { vec2 } from 'gl-matrix';
import { GameObject } from './objects/game-object';
import { BoundingBoxBase } from './physics/bounds/bounding-box-base';

export interface IGame {
  readonly viewArea: BoundingBoxBase;
  findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase>;
  displayToWorldCoordinates(p: vec2): vec2;
  addObject(o: GameObject): void;
  removeObject(o: GameObject): void;
}
