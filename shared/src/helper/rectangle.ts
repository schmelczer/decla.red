import { vec2 } from 'gl-matrix';

export class Rectangle {
  constructor(public topLeft = vec2.create(), public size = vec2.create()) {}
}
