import { Drawer } from './drawer';
import { mat2d, vec2, mat2, mat3 } from 'gl-matrix';
import { FragmentShaderOnlyProgram } from './graphics-library/fragment-shader-only-program';
import { WebGlStopwatch } from './graphics-library/stopwatch';
import { Rectangle } from '../math/rectangle';
import { IntermediateFrameBuffer } from './graphics-library/intermediate-frame-buffer';
import { FrameBuffer } from './graphics-library/frame-buffer';
import { DefaultFrameBuffer } from './graphics-library/default-frame-buffer';
import { translate } from 'gl-matrix/src/gl-matrix/mat2d';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private stopwatch: WebGlStopwatch;

  private viewBox: Rectangle = new Rectangle();
  private uniforms: any;
  private cursorPosition = vec2.create();
  private distanceFieldFrameBuffer: IntermediateFrameBuffer;
  private lightingFrameBuffer: DefaultFrameBuffer;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<string>
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.distanceFieldFrameBuffer = new IntermediateFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, shaderSources[0]),
    ]);

    this.lightingFrameBuffer = new DefaultFrameBuffer(this.gl, [
      new FragmentShaderOnlyProgram(this.gl, shaderSources[1]),
    ]);

    this.distanceFieldFrameBuffer.renderScale = 0.2;
    this.lightingFrameBuffer.renderScale = 1;

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  startFrame(): void {
    this.stopwatch?.start();
    this.uniforms = {};
    this.distanceFieldFrameBuffer.setSize();
    this.lightingFrameBuffer.setSize();
  }

  public finishFrame() {
    const resolution = vec2.fromValues(this.canvas.width, this.canvas.height);

    const distanceScreenToWorld = this.getScreenToWorldTransform(
      this.distanceFieldFrameBuffer.getSize()
    );

    const lightingScreenToWorld = this.getScreenToWorldTransform(
      this.lightingFrameBuffer.getSize()
    );

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
      lightingScreenToWorld,
      worldToDistanceUV,
      cursorPosition,
    });

    this.distanceFieldFrameBuffer.render(this.uniforms);
    this.lightingFrameBuffer.render(
      this.uniforms,
      this.distanceFieldFrameBuffer.texture
    );

    this.stopwatch?.stop();
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
