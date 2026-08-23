import { vec2 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import {
  CharacterTeam,
  Id,
  ProjectileBase,
  settings,
  UpdatePropertyCommand,
} from 'shared';
import { Vec2Interpolator } from '../../helper/interpolators/vec2-interpolator';
import { View } from '../view';

export class ProjectileView extends ProjectileBase implements View {
  private readonly light: CircleLight;
  private readonly centerInterpolator: Vec2Interpolator;

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
    this.centerInterpolator = new Vec2Interpolator(center);
  }

  public updateProperty({ propertyValue, rateOfChange }: UpdatePropertyCommand) {
    this.centerInterpolator.addFrame(propertyValue, rateOfChange);
  }

  public step(deltaTimeInSeconds: number) {
    super.step(deltaTimeInSeconds);

    this.center = this.centerInterpolator.getValue(deltaTimeInSeconds);
    this.light.center = this.center;
    this.light.intensity = Math.min(
      0.1,
      (0.15 * this.strength) / settings.projectileMaxStrength,
    );
  }

  public render(renderer: Renderer) {
    renderer.addDrawable(this.light);
  }
}
