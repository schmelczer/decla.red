import { Drawer } from './drawer';
import { mat2d, vec2, mat2, mat3 } from 'gl-matrix';
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
  private cursorPosition = vec2.create();
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

    this.frameBuffers[0].renderScale = 1;
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
    const resolution = vec2.fromValues(this.canvas.width, this.canvas.height);

    const transform = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(
      transform,
      transform,
      vec2.divide(
        vec2.create(),
        this.viewBox.size,
        this.frameBuffers[0].getSize()
      )
    );
    mat2d.translate(transform, transform, vec2.fromValues(0.5, 0.5));
    this.nextFrameUniforms.transform = transform;

    const transformUV = mat2d.fromScaling(
      mat2d.create(),
      vec2.divide(vec2.create(), vec2.fromValues(1, 1), resolution)
    );
    mat2d.translate(transformUV, transformUV, vec2.fromValues(0.5, 0.5));
    this.nextFrameUniforms.transformUV = transformUV;

    this.frameBuffers[0].render(this.nextFrameUniforms);
    this.frameBuffers[1].render(
      this.nextFrameUniforms,
      (this.frameBuffers[0] as IntermediateFrameBuffer).texture
    );

    this.stopwatch?.stop();
  }

  public setCameraPosition(position: vec2) {
    this.viewBox.topLeft = position;
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public giveUniforms(uniforms: any): void {
    this.nextFrameUniforms = { ...this.nextFrameUniforms, ...uniforms };
  }

  public setInViewArea(size: number): vec2 {
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    this.viewBox.size = vec2.fromValues(
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

  isOnScreen(position: vec2): boolean {
    return this.viewBox.isInside(position);
  }
}
