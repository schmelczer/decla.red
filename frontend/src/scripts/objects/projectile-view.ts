import { vec2 } from 'gl-matrix';
import { Circle, Renderer } from 'sdf-2d';
import { Id, ProjectileBase } from 'shared';
import { ViewObject } from './view-object';

export class ProjectileView extends ProjectileBase implements ViewObject {
  private circle: Circle;

  constructor(id: Id, center: vec2, radius: number) {
    super(id, center, radius);
    this.circle = new Circle(center, radius);
  }

  public step(deltaTimeInMilliseconds: number): void {}

  public draw(renderer: Renderer): void {
    renderer.addDrawable(this.circle);
  }
}
