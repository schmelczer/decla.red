import { vec2 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import {
  CharacterTeam,
  CommandExecutors,
  Id,
  ProjectileBase,
  settings,
  UpdatePropertyCommand,
} from 'shared';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';
import { LinearInterpolator } from '../../helper/interpolators/linear-interpolator';

export class ProjectileView extends ProjectileBase {
  private light: CircleLight;

  private centerX = new LinearInterpolator(0);
  private centerY = new LinearInterpolator(0);

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.handleStep.bind(this),
    [UpdatePropertyCommand.type]: this.updateProperty.bind(this),
  };

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
    this.centerX = new LinearInterpolator(center[0]);
    this.centerY = new LinearInterpolator(center[1]);
  }

  private updateProperty({ propertyValue, rateOfChange }: UpdatePropertyCommand): void {
    this.centerX.addFrame(propertyValue[0], rateOfChange[0]);
    this.centerY.addFrame(propertyValue[1], rateOfChange[1]);
  }

  private handleStep({ deltaTimeInSeconds }: StepCommand): void {
    this.step(deltaTimeInSeconds);

    this.center = vec2.fromValues(
      this.centerX.getValue(deltaTimeInSeconds),
      this.centerY.getValue(deltaTimeInSeconds),
    );
    this.light.center = this.center;
    this.light.intensity = Math.min(
      0.1,
      (0.15 * this.strength) / settings.projectileMaxStrength,
    );
  }

  private draw({ renderer }: RenderCommand): void {
    renderer.addDrawable(this.light);
  }
}
