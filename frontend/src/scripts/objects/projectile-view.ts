import { vec2 } from 'gl-matrix';
import { CircleLight, ColorfulCircle, Renderer } from 'sdf-2d';
import { CharacterTeam, Id, ProjectileBase, settings } from 'shared';
import { ViewObject } from './view-object';

export class ProjectileView extends ProjectileBase implements ViewObject {
  private circle: ColorfulCircle;
  private light: CircleLight;

  constructor(
    id: Id,
    center: vec2,
    radius: number,
    team: CharacterTeam,
    strength: number,
  ) {
    super(id, center, radius, team, strength);
    this.circle = new ColorfulCircle(center, radius / 2, settings.colorIndices[team]);
    this.light = new CircleLight(
      center,
      settings.paletteDim[settings.colorIndices[team]],
      0,
    );
  }

  public step(deltaTimeInSeconds: number): void {
    super.step(deltaTimeInSeconds);

    this.circle.center = this.center;
    this.light.center = this.center;
    this.light.intensity = (0.15 * this.strength) / settings.projectileMaxStrength;
  }

  public beforeDestroy(): void {}

  public draw(
    renderer: Renderer,
    overlay: HTMLElement,
    shouldChangeLayout: boolean,
  ): void {
    renderer.addDrawable(this.circle);
    renderer.addDrawable(this.light);
  }
}
