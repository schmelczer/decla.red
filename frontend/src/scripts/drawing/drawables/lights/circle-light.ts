import { vec2, vec3, mat2d } from 'gl-matrix';
import { GameObject } from '../../../objects/game-object';
import { settings } from '../../settings';
import { IDrawableDescriptor } from '../i-drawable-descriptor';
import { ILight } from './i-light';

export class CircleLight implements ILight {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'circleLights',
    countMacroName: 'circleLightCount',
    shaderCombinationSteps: settings.shaderCombinations.circleLightSteps,
  };

  constructor(
    public center: vec2,
    public radius: number,
    public color: vec3,
    public lightness: number
  ) {}

  public distance(target: vec2): number {
    return 0;
  }

  public serializeToUniforms(
    uniforms: any,
    scale: number,
    transform: mat2d
  ): void {
    const uniformName = CircleLight.descriptor.uniformName;

    if (!uniforms.hasOwnProperty(uniformName)) {
      uniforms[uniformName] = [];
    }

    uniforms[uniformName].push({
      center: vec2.transformMat2d(vec2.create(), this.center, transform),
      radius: this.radius * scale,
      value: this.value,
    });
  }

  public get value(): vec3 {
    return vec3.scale(
      vec3.create(),
      vec3.normalize(this.color, this.color),
      this.lightness
    );
  }
}
