import { ILight } from './i-light';
import { vec2, vec3 } from 'gl-matrix';
import { settings } from '../../settings';
import { IDrawableDescriptor } from '../i-drawable-descriptor';

export class CircleLight implements ILight {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'lights',
    countMacroName: 'lightCount',
    shaderCombinationSteps: settings.shaderCombinations.circleLightSteps,
  };

  constructor(
    public center: vec2,
    public radius: number,
    public color: vec3,
    public lightness: number
  ) {}

  distance(target: vec2): number {
    return 0;
  }

  minimumDistance(target: vec2): number {
    return 0;
  }

  serializeToUniforms(uniforms: any): void {
    const listName = CircleLight.descriptor.uniformName;

    if (!uniforms.hasOwnProperty(listName)) {
      uniforms[listName] = [];
    }

    uniforms[listName].push({
      center: this.center,
      radius: this.radius,
      value: this.value,
    });
  }

  get value(): vec3 {
    return vec3.scale(
      vec3.create(),
      vec3.normalize(this.color, this.color),
      this.lightness
    );
  }
}
