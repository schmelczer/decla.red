import { ILight } from './i-light';
import { vec2, vec3 } from 'gl-matrix';

export class PointLight implements ILight {
  public static uniformName = 'lights';

  constructor(
    public center: vec2,
    public color: vec3,
    public lightness: number
  ) {}

  serializeToUniforms(uniforms: any): void {
    const listName = PointLight.uniformName;

    if (!uniforms.hasOwnProperty(listName)) {
      uniforms[listName] = [];
    }

    uniforms[listName].push({
      center: this.center,
      radius: 0,
      value: this.value,
    });
  }

  get value(): vec3 {
    return vec3.scale(vec3.create(), this.color, this.lightness);
  }
}
