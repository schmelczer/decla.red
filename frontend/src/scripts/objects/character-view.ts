import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { CharacterBase, CharacterTeam, Circle, Id, settings } from 'shared';

import { BlobShape } from '../shapes/blob-shape';
import { ViewObject } from './view-object';

export class CharacterView extends CharacterBase implements ViewObject {
  private shape: BlobShape;

  constructor(
    id: Id,
    team: CharacterTeam,
    health: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, team, health, head, leftFoot, rightFoot);
    this.shape = new BlobShape(settings.colorIndices[team]);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  public beforeDestroy(): void {}

  public step(deltaTimeInSeconds: number): void {}

  public draw(renderer: Renderer, overlay: HTMLElement): void {
    this.shape.setCircles([this.head!, this.leftFoot!, this.rightFoot!]);
    renderer.addDrawable(this.shape);
  }
}
