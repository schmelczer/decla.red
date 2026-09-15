import { vec2, vec3 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import { Id, LampBase, mix, mixRgb, settings, smoothing } from 'shared';
import { View } from '../view';

export class LampView extends LampBase implements View {
  private readonly light: CircleLight;
  private targetColor: vec3;
  private targetLightness: number;

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

  public step(deltaTimeInSeconds: number) {
    const t = smoothing(deltaTimeInSeconds, settings.lampLerpSeconds);
    this.light.color = mixRgb(this.light.color, this.targetColor, t);
    this.light.intensity = mix(this.light.intensity, this.targetLightness, t);
  }

  public render(renderer: Renderer) {
    renderer.addDrawable(this.light);
  }
}
