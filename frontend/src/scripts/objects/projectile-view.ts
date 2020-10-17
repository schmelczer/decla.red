import { vec2 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import { Id, ProjectileBase, rgb, UpdateMessage } from 'shared';
import { ViewObject } from './view-object';
import { Circle } from '../shapes/circle';

export class ProjectileView extends ProjectileBase implements ViewObject {
  private circle: InstanceType<typeof Circle>;
  private light: CircleLight;

  constructor(id: Id, center: vec2, radius: number) {
    super(id, center, radius);
    this.circle = new Circle(center, radius / 2);
    this.light = new CircleLight(center, rgb(1, 0.5, 0), 0.15);
  }

  update(updates: Array<UpdateMessage>): void {
    updates.forEach((u) => ((this as any)[u.key] = u.value));
  }

  public step(deltaTimeInMilliseconds: number): void {
    this.circle.center = this.center;
    this.light.center = this.center;
  }

  public draw(renderer: Renderer): void {
    renderer.addDrawable(this.circle);
    renderer.addDrawable(this.light);
  }
}
