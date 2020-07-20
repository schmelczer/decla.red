import { Drawer } from './drawer';
import { Vec2 } from '../math/vec2';
import { createProgram } from './graphics-library/create-program';
import { prepareScreenQuad } from './graphics-library/prepare-screen-quad';
import { Mat3 } from '../math/mat3';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;

  public enableHighDpiRendering = false;
  public renderScale = 0.33;

  private cameraPosition: Vec2;
  private viewBoxSize: Vec2;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    shaderSources: [string, string]
  ) {
    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 is not supported');
    }

    this.program = createProgram(this.gl, ...shaderSources);
    this.vao = prepareScreenQuad(this.gl, this.program, 'a_position');
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
    this.handleResize();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
  }

  finishFrame() {
    const resolution = new Vec2(this.canvas.width, this.canvas.height);

    const transform = Mat3.translateMatrix(new Vec2(0.5, 0.5))
      .times(Mat3.scaleMatrix(this.viewBoxSize.divide(resolution)))
      .times(Mat3.translateMatrix(this.cameraPosition));

    const viewBoxSizeUniformLocation = this.gl.getUniformLocation(
      this.program,
      'transform'
    );
    this.gl.uniformMatrix3fv(
      viewBoxSizeUniformLocation,
      false,
      new Float32Array(transform.transposedFlat)
    );

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  setCameraPosition(position: Vec2) {
    this.cameraPosition = position;
  }

  setInViewArea(size: number): Vec2 {
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    this.viewBoxSize = new Vec2(
      Math.sqrt(size * canvasAspectRatio),
      Math.sqrt(size / canvasAspectRatio)
    );
    return this.viewBoxSize;
  }

  drawInfoText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }
}
