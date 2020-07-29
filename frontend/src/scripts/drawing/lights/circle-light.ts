import { ILight } from './i-light';
import { vec2, vec3 } from 'gl-matrix';

export class CircleLight implements ILight {
  public static uniformName = 'lights';

  constructor(
    public center: vec2,
    public radius: number,
    public color: vec3,
    public lightness: number
  ) {}

  serializeToUniforms(uniforms: any): void {
    const listName = CircleLight.uniformName;

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
