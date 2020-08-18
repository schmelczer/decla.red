import { IDrawable } from './i-drawable';
import { TunnelShape } from '../../shapes/types/tunnel-shape';
import { IDrawableDescriptor } from './i-drawable-descriptor';
import { settings } from '../settings';
import { mat2d, vec2 } from 'gl-matrix';

export class DrawableTunnel extends TunnelShape implements IDrawable {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'lines',
    countMacroName: 'lineCount',
    shaderCombinationSteps: settings.shaderCombinations.lineSteps,
  };

  public serializeToUniforms(
    uniforms: any,
    scale: number,
    transform: mat2d
  ): void {
    const uniformName = DrawableTunnel.descriptor.uniformName;
    if (!uniforms.hasOwnProperty(uniformName)) {
      uniforms[uniformName] = [];
    }

    uniforms[uniformName].push({
      from: vec2.transformMat2d(vec2.create(), this.from, transform),
      toFromDelta: vec2.transformMat2d(
        vec2.create(),
        this.toFromDelta,
        transform
      ),
      fromRadius: this.fromRadius * scale,
      toRadius: this.toRadius * scale,
    });
  }
}
