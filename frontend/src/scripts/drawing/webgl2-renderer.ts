import { Drawer } from './drawer';
import { Vec2 } from '../math/vec2';
import { Mat3 } from '../math/mat3';
import { FragmentShaderOnlyProgram } from './graphics-library/fragment-shader-only-program';
import { WebGlStopwatch } from './graphics-library/stopwatch';
import { Rectangle } from '../math/rectangle';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private program: FragmentShaderOnlyProgram;
  private stopwatch: WebGlStopwatch;

  public enableHighDpiRendering = false;
  public renderScale = 0.5;

  private viewBox: Rectangle = new Rectangle();

  private nextFrameUniforms: any;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: Array<string>
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.program = new FragmentShaderOnlyProgram(this.gl, shaderSources[0]);

    try {
      this.stopwatch = new WebGlStopwatch(this.gl);
    } catch {}
  }

  private handleResize() {
    const realToCssPixels = window.devicePixelRatio * this.renderScale;

    const displayWidth = Math.floor(this.canvas.clientWidth * realToCssPixels);
    const displayHeight = Math.floor(
      this.canvas.clientHeight * realToCssPixels
    );

    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public startFrame() {
    this.stopwatch?.start();

    this.handleResize();

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.program.bind();
    this.nextFrameUniforms = {};
  }

  public finishFrame() {
    const resolution = new Vec2(this.canvas.width, this.canvas.height);

    this.nextFrameUniforms.transform = Mat3.translateMatrix(new Vec2(0.5, 0.5))
      .times(Mat3.scaleMatrix(this.viewBox.size.divide(resolution)))
      .times(Mat3.translateMatrix(this.viewBox.topLeft));

    this.program.setUniforms(this.nextFrameUniforms);
    this.program.draw();

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
