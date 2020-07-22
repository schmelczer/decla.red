import { Drawer } from './drawer';
import { Vec2 } from '../math/vec2';
import { Mat3 } from '../math/mat3';
import { FragmentShaderOnlyProgram } from './graphics-library/fragment-shader-only-program';
import { WebGlStopwatch } from './graphics-library/stopwatch';
import { Rectangle } from '../math/rectangle';
import { IntermediateFrameBuffer } from './graphics-library/intermediate-frame-buffer';
import { FrameBuffer } from './graphics-library/frame-buffer';
import { DefaultFrameBuffer } from './graphics-library/default-frame-buffer';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private stopwatch: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private nextFrameUniforms: any;
  private frameBuffers: Array<FrameBuffer> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<string>
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.frameBuffers.push(
      new IntermediateFrameBuffer(this.gl, [
        new FragmentShaderOnlyProgram(this.gl, shaderSources[0]),
      ])
    );

    this.frameBuffers.push(
      new DefaultFrameBuffer(this.gl, [
        new FragmentShaderOnlyProgram(this.gl, shaderSources[1]),
      ])
    );

    this.frameBuffers[0].renderScale = 0.2;
    this.frameBuffers[1].renderScale = 1;

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  startFrame(): void {
    this.stopwatch?.start();
    this.nextFrameUniforms = {};
    this.frameBuffers.forEach((f) => f.setSize());
  }

  public finishFrame() {
    const resolution = new Vec2(this.canvas.width, this.canvas.height);

    this.nextFrameUniforms.transform = Mat3.translateMatrix(new Vec2(0.5, 0.5))
      .times(
        Mat3.scaleMatrix(
          this.viewBox.size.divide(this.frameBuffers[0].getSize())
        )
      )
      .times(Mat3.translateMatrix(this.viewBox.topLeft));

    this.nextFrameUniforms.transformUV = Mat3.translateMatrix(
      new Vec2(0.5, 0.5)
    ).times(Mat3.scaleMatrix(new Vec2(1).divide(resolution)));

    this.frameBuffers[0].render(this.nextFrameUniforms);
    this.frameBuffers[1].render(
      this.nextFrameUniforms,
      (this.frameBuffers[0] as IntermediateFrameBuffer).texture
    );

    this.stopwatch?.stop();
  }

  public setCameraPosition(position: Vec2) {
    this.viewBox.topLeft = position;
  }

  public giveUniforms(uniforms: any): void {
    this.nextFrameUniforms = { ...this.nextFrameUniforms, ...uniforms };
  }

  public setInViewArea(size: number): Vec2 {
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    this.viewBox.size = new Vec2(
      Math.sqrt(size * canvasAspectRatio),
      Math.sqrt(size / canvasAspectRatio)
    );
    return this.viewBox.size;
  }

  public drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }

  isOnScreen(position: Vec2): boolean {
    return this.viewBox.isInside(position);
  }
}
