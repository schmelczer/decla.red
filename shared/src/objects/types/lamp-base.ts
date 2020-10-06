import { vec2, vec3 } from 'gl-matrix';
import { Id } from '../../main';
import { GameObject } from '../game-object';

export abstract class LampBase extends GameObject {
  constructor(id: Id, public center: vec2, public color: vec3, public lightness: number) {
    super(id);
  }
}
