import { IDrawable } from './i-drawable';
import { IDrawableDescriptor } from './i-drawable-descriptor';
import { settings } from '../settings';
import { Blob } from '../../shapes/types/blob';

export class DrawableBlob extends Blob implements IDrawable {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'blobs',
    countMacroName: 'blobCount',
    shaderCombinationSteps: settings.shaderCombinations.blobSteps,
  };

  public serializeToUniforms(uniforms: any): void {
    const uniformName = DrawableBlob.descriptor.uniformName;
    if (!uniforms.hasOwnProperty(uniformName)) {
      uniforms[uniformName] = [];
    }

    uniforms[uniformName].push({
      headCenter: this.head.center,
      torsoCenter: this.torso.center,
      leftFootCenter: this.leftFoot.center,
      rightFootCenter: this.rightFoot.center,
    });
  }
}
