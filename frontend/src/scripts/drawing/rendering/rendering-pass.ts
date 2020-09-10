import { mat2d, vec2 } from 'gl-matrix';
import { InfoText } from '../../objects/types/info-text';
import { IDrawable } from '../drawables/i-drawable';
import { IDrawableDescriptor } from '../drawables/i-drawable-descriptor';
import { FrameBuffer } from '../graphics-library/frame-buffer/frame-buffer';
import { UniformArrayAutoScalingProgram } from '../graphics-library/program/uniform-array-autoscaling-program';
import { settings } from '../settings';

export class RenderingPass {
  private drawables: Array<IDrawable> = [];

  private program: UniformArrayAutoScalingProgram;

  constructor(
    gl: WebGL2RenderingContext,
    shaderSources: [string, string],
    private drawableDescriptors: Array<IDrawableDescriptor>,
    private frame: FrameBuffer
  ) {
    this.program = new UniformArrayAutoScalingProgram(
      gl,
      shaderSources,
      drawableDescriptors
    );
  }

  public async initialize(): Promise<void> {
    await this.program.initialize();
  }

  public addDrawable(drawable: IDrawable) {
    this.drawables.push(drawable);
  }

  public render(
    commonUniforms: any,
    scale: number,
    transform: mat2d,
    inputTexture?: WebGLTexture
  ) {
    this.frame.bindAndClear(inputTexture);
    const q = 1 / settings.tileMultiplier;
    const tileUvSize = vec2.fromValues(q, q);

    const origin = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(0, 0),
      commonUniforms.uvToWorld
    );

    const firstCenter = vec2.transformMat2d(
      vec2.create(),
      vec2.fromValues(q, q),
      commonUniforms.uvToWorld
    );

    vec2.subtract(firstCenter, firstCenter, origin);

    const worldR = vec2.length(firstCenter);

    let sumLineCount = 0;

    for (let x = 0; x < 1; x += q) {
      for (let y = 0; y < 1; y += q) {
        const uniforms = { ...commonUniforms };
        uniforms.maxMinDistance = 2 * worldR * scale;

        const uvBottomLeft = vec2.fromValues(x, y);
        this.program.setDrawingRectangle(uvBottomLeft, tileUvSize);

        const tileCenterWorldCoordinates = vec2.transformMat2d(
          vec2.create(),
          vec2.add(vec2.create(), uvBottomLeft, vec2.fromValues(q, q)),
          uniforms.uvToWorld
        );

        const primitivesNearTile = this.drawables.filter(
          (d) => d.distance(tileCenterWorldCoordinates) < 2 * worldR
        );

        sumLineCount += primitivesNearTile.length;

        primitivesNearTile.forEach((p) =>
          p.serializeToUniforms(uniforms, scale, transform)
        );

        this.program.bindAndSetUniforms(uniforms);
        this.program.draw();
      }
    }

    InfoText.modifyRecord(
      `nearby ${this.drawableDescriptors[0].countMacroName}`,
      this.drawables.length.toFixed(2)
    );

    InfoText.modifyRecord(
      `drawn ${this.drawableDescriptors[0].countMacroName}`,
      (sumLineCount / settings.tileMultiplier / settings.tileMultiplier).toFixed(2)
    );

    this.drawables = [];
  }
}
