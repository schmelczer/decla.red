import { vec2 } from 'gl-matrix';
import { CircleLight, ColorfulCircle, Renderer } from 'sdf-2d';
import { Id, ProjectileBase, settings, UpdateMessage } from 'shared';
import { ViewObject } from './view-object';

export class ProjectileView extends ProjectileBase implements ViewObject {
  private circle: ColorfulCircle;
  private light: CircleLight;

  constructor(
    id: Id,
    center: vec2,
    radius: number,
    colorIndex: number,
    strength: number,
  ) {
    super(id, center, radius, colorIndex, strength);
    this.circle = new ColorfulCircle(center, radius / 2, colorIndex);
    this.light = new CircleLight(center, settings.palette[colorIndex], 0);
  }

  public step(deltaTimeInMilliseconds: number): void {
    this.circle.center = this.center;
    this.light.center = this.center;
    this.light.intensity = (0.15 * this.strength) / settings.projectileMaxStrength;
  }

  public beforeDestroy(): void {}

  public draw(renderer: Renderer, overlay: HTMLElement): void {
    renderer.addDrawable(this.circle);
    renderer.addDrawable(this.light);
  }
}
