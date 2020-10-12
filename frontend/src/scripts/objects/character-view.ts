import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { CharacterBase, Circle, Id } from 'shared';

import { BlobShape } from '../shapes/blob-shape';
import { ViewObject } from './view-object';

export class CharacterView extends CharacterBase implements ViewObject {
  private shape: BlobShape;

  constructor(
    id: Id,
    colorIndex: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, colorIndex, head, leftFoot, rightFoot);
    this.shape = new BlobShape(colorIndex);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  public step(deltaTimeInMilliseconds: number): void {}

  public draw(renderer: Renderer): void {
    this.shape.setCircles([this.head!, this.leftFoot!, this.rightFoot!]);
    renderer.addDrawable(this.shape);
  }
}
