import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import { CommandExecutors, Id, LampBase, mixRgb, settings } from 'shared';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';

export class LampView extends LampBase {
  private light: CircleLight;

  private targetColor: vec3;
  private targetLightness: number;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.step.bind(this),
  };

  constructor(id: Id, center: vec2, color: vec3, lightness: number) {
    super(id, center, color, lightness);
    this.light = new CircleLight(vec2.clone(center), vec3.clone(color), lightness);
    this.targetColor = vec3.clone(color);
    this.targetLightness = lightness;
  }

  public setLight(color: vec3, lightness: number) {
    this.targetColor = vec3.clone(color);
    this.targetLightness = lightness;
  }

  private step({ deltaTimeInSeconds }: StepCommand): void {
    const t = 1 - Math.exp(-deltaTimeInSeconds / settings.lampLerpSeconds);
    this.light.color = mixRgb(this.light.color, this.targetColor, t);
    this.light.intensity += (this.targetLightness - this.light.intensity) * t;
  }

  private draw({ renderer }: RenderCommand): void {
    renderer.addDrawable(this.light);
  }
}
