import { mat2d, vec2 } from 'gl-matrix';
import { Blob } from '../../shapes/types/blob';
import { settings } from '../settings';
import { IDrawable } from './i-drawable';
import { IDrawableDescriptor } from './i-drawable-descriptor';

export class DrawableBlob extends Blob implements IDrawable {
  public static descriptor: IDrawableDescriptor = {
    uniformName: 'blobs',
    countMacroName: 'blobCount',
    shaderCombinationSteps: settings.shaderCombinations.blobSteps,
  };

  public serializeToUniforms(uniforms: any, scale: number, transform: mat2d): void {
    const { uniformName } = DrawableBlob.descriptor;
    if (!Object.prototype.hasOwnProperty.call(uniforms, uniformName)) {
      uniforms[uniformName] = [];
    }

    uniforms[uniformName].push({
      headCenter: vec2.transformMat2d(vec2.create(), this.head.center, transform),
      torsoCenter: vec2.transformMat2d(vec2.create(), this.torso.center, transform),
      leftFootCenter: vec2.transformMat2d(vec2.create(), this.leftFoot.center, transform),
      rightFootCenter: vec2.transformMat2d(
        vec2.create(),
        this.rightFoot.center,
        transform
      ),
    });
  }
}
