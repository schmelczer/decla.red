import { mat2d, vec2, vec3 } from 'gl-matrix';
import { settings } from '../../settings';
import { IDrawableDescriptor } from '../i-drawable-descriptor';
import { ILight } from './i-light';

export class PointLight implements ILight {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'pointLights',
    countMacroName: 'pointLightCount',
    shaderCombinationSteps: settings.shaderCombinations.pointLightSteps,
    empty: new PointLight(vec2.fromValues(0, 0), 0, vec3.fromValues(0, 0, 0), 0),
  };

  public constructor(
    public center: vec2,
    public radius: number,
    public color: vec3,
    public lightness: number
  ) {}

  public distance(target: vec2): number {
    return vec2.distance(this.center, target) - this.radius;
  }

  public serializeToUniforms(uniforms: any, scale: number, transform: mat2d): void {
    const listName = PointLight.descriptor.uniformName;

    if (!Object.prototype.hasOwnProperty.call(uniforms, listName)) {
      uniforms[listName] = [];
    }

    uniforms[listName].push({
      center: vec2.transformMat2d(vec2.create(), this.center, transform),
      radius: this.radius * scale,
      value: this.value,
    });
  }

  public get value(): vec3 {
    return vec3.scale(vec3.create(), this.color, this.lightness);
  }
}
