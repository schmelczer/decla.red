import { ILight } from './i-light';
import { vec2, vec3 } from 'gl-matrix';
import { IDrawableDescriptor } from '../i-drawable-descriptor';
import { settings } from '../../settings';

export class PointLight implements ILight {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'pointLights',
    countMacroName: 'pointLightCount',
    shaderCombinationSteps: settings.shaderCombinations.pointLightSteps,
  };

  constructor(
    public center: vec2,
    public radius: number,
    public color: vec3,
    public lightness: number
  ) {}

  public distance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public minimumDistance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public serializeToUniforms(uniforms: any): void {
    const listName = PointLight.descriptor.uniformName;

    if (!uniforms.hasOwnProperty(listName)) {
      uniforms[listName] = [];
    }

    uniforms[listName].push({
      center: this.center,
      radius: this.radius,
      value: this.value,
    });
  }

  public get value(): vec3 {
    return vec3.scale(vec3.create(), this.color, this.lightness);
  }
}
