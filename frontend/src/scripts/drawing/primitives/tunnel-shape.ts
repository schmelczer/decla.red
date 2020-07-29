import { vec2 } from 'gl-matrix';
import { clamp01 } from '../../helper/clamp';
import { mix } from '../../helper/mix';
import { Circle } from './circle';
import { IPrimitive } from './i-primitive';

export class TunnelShape implements IPrimitive {
  public static uniformNameLines = 'lines';
  public static uniformNameRadii = 'radii';

  public readonly toFromDelta: vec2;
  private toFromDeltaLength: number;

  private boundingCircle: Circle;

  constructor(
    public readonly from: vec2,
    public readonly to: vec2,
    public readonly fromRadius: number,
    public readonly toRadius: number
  ) {
    this.toFromDelta = vec2.subtract(vec2.create(), to, from);
    this.toFromDeltaLength = vec2.length(this.toFromDelta);

    this.boundingCircle = new Circle(
      vec2.fromValues(from.x / 2 + to.x / 2, from.y / 2 + to.y / 2),
      Math.max(fromRadius, toRadius) + vec2.distance(from, to)
    );
  }

  serializeToUniforms(uniforms: any): void {
    if (!uniforms.hasOwnProperty(TunnelShape.uniformNameLines)) {
      uniforms[TunnelShape.uniformNameLines] = [];
    }

    if (!uniforms.hasOwnProperty(TunnelShape.uniformNameRadii)) {
      uniforms[TunnelShape.uniformNameRadii] = [];
    }

    uniforms[TunnelShape.uniformNameLines].push(this.from);
    uniforms[TunnelShape.uniformNameLines].push(this.toFromDelta);
    uniforms[TunnelShape.uniformNameRadii].push(this.fromRadius);
    uniforms[TunnelShape.uniformNameRadii].push(this.toRadius);
  }

  public distance(target: vec2): number {
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);
    const h = clamp01(
      vec2.dot(targetFromDelta, this.toFromDelta) /
        this.toFromDeltaLength /
        this.toFromDeltaLength
    );
    return (
      vec2.distance(
        targetFromDelta,
        vec2.scale(vec2.create(), this.toFromDelta, h)
      ) - mix(this.fromRadius, this.toRadius, h)
    );
  }

  public minimumDistance(target: vec2): number {
    return this.boundingCircle.distance(target);
  }
}
