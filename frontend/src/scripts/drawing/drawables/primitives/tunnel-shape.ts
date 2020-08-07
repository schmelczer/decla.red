import { vec2 } from 'gl-matrix';
import { clamp01 } from '../../../helper/clamp';
import { mix } from '../../../helper/mix';
import { GameObject } from '../../../objects/game-object';
import { ImmutableBoundingBox } from '../../../physics/containers/immutable-bounding-box';
import { settings } from '../../settings';
import { IDrawableDescriptor } from '../i-drawable-descriptor';
import { Circle } from './circle';
import { IPrimitive } from './i-primitive';

export class TunnelShape implements IPrimitive {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'lines',
    countMacroName: 'lineCount',
    shaderCombinationSteps: settings.shaderCombinations.lineSteps,
  };

  public readonly toFromDelta: vec2;

  private boundingCircle: Circle;

  constructor(
    public readonly owner: GameObject,
    public readonly from: vec2,
    public readonly to: vec2,
    public readonly fromRadius: number,
    public readonly toRadius: number
  ) {
    this.toFromDelta = vec2.subtract(vec2.create(), to, from);

    this.boundingCircle = new Circle(
      this.owner,
      vec2.fromValues(from.x / 2 + to.x / 2, from.y / 2 + to.y / 2),
      Math.max(fromRadius, toRadius) + vec2.distance(from, to)
    );
  }

  public serializeToUniforms(uniforms: any): void {
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

  public get boundingBox(): ImmutableBoundingBox {
    const xMin = Math.min(
      this.from.x - this.fromRadius,
      this.to.x - this.toRadius
    );
    const yMin = Math.min(
      this.from.y - this.fromRadius,
      this.to.y - this.toRadius
    );
    const xMax = Math.max(
      this.from.x + this.fromRadius,
      this.to.x + this.toRadius
    );
    const yMax = Math.max(
      this.from.y + this.fromRadius,
      this.to.y + this.toRadius
    );

    return new ImmutableBoundingBox(this, xMin, xMax, yMin, yMax);
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

  public clone(): TunnelShape {
    return new TunnelShape(
      this.owner,
      this.from,
      this.to,
      this.fromRadius,
      this.toRadius
    );
  }
}
