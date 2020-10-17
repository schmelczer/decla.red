import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { Circle, Id, PlayerCharacterBase, UpdateMessage } from 'shared';

import { BlobShape } from '../shapes/blob-shape';
import { ViewObject } from './view-object';

export class PlayerCharacterView extends PlayerCharacterBase implements ViewObject {
  private shape: BlobShape;

  constructor(
    id: Id,
    name: string,
    colorIndex: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, name, colorIndex, head, leftFoot, rightFoot);
    this.shape = new BlobShape(colorIndex);
  }

  public update(updates: Array<UpdateMessage>) {
    updates.forEach((u) => ((this as any)[u.key] = u.value));
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
