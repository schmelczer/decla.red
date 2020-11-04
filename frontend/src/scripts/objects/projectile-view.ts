import { vec2 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import { CharacterTeam, Id, ProjectileBase, settings, UpdateProperty } from 'shared';
import { Vec2Extrapolator } from '../helper/vec2-extrapolator';
import { ViewObject } from './view-object';

export class ProjectileView extends ProjectileBase implements ViewObject {
  private light: CircleLight;

  private centerExtrapolator: Vec2Extrapolator;

  constructor(
    id: Id,
    center: vec2,
    radius: number,
    team: CharacterTeam,
    strength: number,
  ) {
    super(id, center, radius, team, strength);
    this.light = new CircleLight(
      center,
      settings.paletteDim[settings.colorIndices[team]],
      0,
    );
    this.centerExtrapolator = new Vec2Extrapolator(center);
  }

  public updateProperties(update: UpdateProperty[]): void {
    update.forEach((u) => {
      this.centerExtrapolator.addFrame(u.propertyValue, u.rateOfChange);
    });
  }

  public step(deltaTimeInSeconds: number): void {
    super.step(deltaTimeInSeconds);

    this.center = this.centerExtrapolator.getValue(deltaTimeInSeconds);
    this.light.center = this.center;
    this.light.intensity = (0.15 * this.strength) / settings.projectileMaxStrength;
  }

  public beforeDestroy(): void {}

  public draw(
    renderer: Renderer,
    overlay: HTMLElement,
    shouldChangeLayout: boolean,
  ): void {
    renderer.addDrawable(this.light);
  }
}
