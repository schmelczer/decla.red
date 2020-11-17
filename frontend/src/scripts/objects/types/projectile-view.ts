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
import { Vec2Extrapolator } from '../../helper/extrapolators/vec2-extrapolator';

export class ProjectileView extends ProjectileBase {
  private light: CircleLight;

  private centerExtrapolator: Vec2Extrapolator;

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
    this.centerExtrapolator = new Vec2Extrapolator(center);
  }

  private updateProperty({ propertyValue, rateOfChange }: UpdatePropertyCommand): void {
    this.centerExtrapolator.addFrame(propertyValue, rateOfChange);
  }

  private handleStep({ deltaTimeInSeconds }: StepCommand): void {
    this.step(deltaTimeInSeconds);

    this.center = this.centerExtrapolator.getValue(deltaTimeInSeconds);
    this.light.center = this.center;
    this.light.intensity = (0.15 * this.strength) / settings.projectileMaxStrength;
  }

  private draw({ renderer }: RenderCommand): void {
    renderer.addDrawable(this.light);
  }
}
