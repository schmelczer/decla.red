import { mat2d, vec2 } from 'gl-matrix';
import { Rectangle } from '../math/rectangle';
import { Drawer } from './drawer';
import { DefaultFrameBuffer } from './graphics-library/default-frame-buffer';
import { FragmentShaderOnlyProgram } from './graphics-library/fragment-shader-only-program';
import { IntermediateFrameBuffer } from './graphics-library/intermediate-frame-buffer';
import { WebGlStopwatch } from './graphics-library/stopwatch';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private stopwatch?: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private uniforms: any;
  private cursorPosition = vec2.create();
  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<[string, string]>
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, ...shaderSources[0]),
    ]);

    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, ...shaderSources[1]),
    ]);

    this.distanceFieldFrameBuffer.renderScale = 0.5;
    this.lightingFrameBuffer.renderScale = 1;

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  public startFrame(): void {
    this.stopwatch?.start();
    this.uniforms = {};
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    this.calculateOwnUniforms();

    this.distanceFieldFrameBuffer.render(this.uniforms);
    this.lightingFrameBuffer.render(
      this.uniforms,
      this.distanceFieldFrameBuffer.colorTexture
    );

    this.stopwatch?.stop();
  }

  private calculateOwnUniforms() {
    const resolution = vec2.fromValues(this.canvas.width, this.canvas.height);

    const distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    const ndcToWorld = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(ndcToWorld, ndcToWorld, this.viewBox.size);
    mat2d.scale(ndcToWorld, ndcToWorld, vec2.fromValues(0.5, 0.5));
    mat2d.translate(ndcToWorld, ndcToWorld, vec2.fromValues(1, 1));

    const screenToWorld = this.getScreenToWorldTransform(resolution);

    const worldToDistanceUV = mat2d.scale(
      mat2d.create(),
      distanceScreenToWorld,
      this.distanceFieldFrameBuffer.getSize()
    );
    mat2d.invert(worldToDistanceUV, worldToDistanceUV);

    const cursorPosition = vec2.transformMat2d(
      vec2.create(),
      vec2.multiply(vec2.create(), this.cursorPosition, resolution),
      screenToWorld
    );

    this.giveUniforms({
      distanceScreenToWorld,
      worldToDistanceUV,
      cursorPosition,
      ndcToWorld,
      viewBoxSize: this.viewBox.size,
    });
  }

  private getScreenToWorldTransform(screenSize: vec2) {
    const transform = mat2d.fromTranslation(
      mat2d.create(),
      this.viewBox.topLeft
    );
    mat2d.scale(
      transform,
      transform,
      vec2.divide(vec2.create(), this.viewBox.size, screenSize)
    );
    mat2d.translate(transform, transform, vec2.fromValues(0.5, 0.5));

    return transform;
  }

  public setCameraPosition(position: vec2) {
    this.viewBox.topLeft = position;
  }

  public setCursorPosition(position: vec2): void {
    this.cursorPosition = position;
  }

  public giveUniforms(uniforms: any): void {
    this.uniforms = { ...this.uniforms, ...uniforms };
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
