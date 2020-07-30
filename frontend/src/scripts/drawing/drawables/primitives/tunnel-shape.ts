import { vec2 } from 'gl-matrix';
import { clamp01 } from '../../../helper/clamp';
import { mix } from '../../../helper/mix';
import { Circle } from './circle';
import { IPrimitive } from './i-primitive';
import { IDrawableDescriptor } from '../i-drawable-descriptor';
import { settings } from '../../settings';

export class TunnelShape implements IPrimitive {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'lines',
    countMacroName: 'lineCount',
    shaderCombinationSteps: settings.shaderCombinations.lineSteps,
  };

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

    this.boundingCircle = new Circle(
      vec2.fromValues(from.x / 2 + to.x / 2, from.y / 2 + to.y / 2),
      Math.max(fromRadius, toRadius) + vec2.distance(from, to)
    );
  }

  serializeToUniforms(uniforms: any): void {
    if (!uniforms.hasOwnProperty(TunnelShape.descriptor.uniformName)) {
      uniforms[TunnelShape.descriptor.uniformName] = [];
    }

    uniforms[TunnelShape.descriptor.uniformName].push({
      from: this.from,
      toFromDelta: this.toFromDelta,
      fromRadius: this.fromRadius,
      toRadius: this.toRadius,
    });
  }

  public distance(target: vec2): number {
    const targetFromDelta = vec2.subtract(vec2.create(), target, this.from);
    const h = clamp01(
      vec2.dot(targetFromDelta, this.toFromDelta) /
        vec2.dot(this.toFromDelta, this.toFromDelta)
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
