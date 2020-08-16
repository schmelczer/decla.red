import { IDrawable } from './i-drawable';
import { TunnelShape } from '../../shapes/types/tunnel-shape';
import { IDrawableDescriptor } from './i-drawable-descriptor';
import { settings } from '../settings';

export class DrawableTunnel extends TunnelShape implements IDrawable {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'lines',
    countMacroName: 'lineCount',
    shaderCombinationSteps: settings.shaderCombinations.lineSteps,
  };

  public serializeToUniforms(uniforms: any): void {
    const uniformName = DrawableTunnel.descriptor.uniformName;
    if (!uniforms.hasOwnProperty(uniformName)) {
      uniforms[uniformName] = [];
    }

    uniforms[uniformName].push({
      from: this.from,
      toFromDelta: this.toFromDelta,
      fromRadius: this.fromRadius,
      toRadius: this.toRadius,
    });
  }
}
