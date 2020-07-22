import { FragmentShaderOnlyProgram } from './fragment-shader-only-program';
import { vec2 } from 'gl-matrix';

export abstract class FrameBuffer {
  public renderScale = 1;
  public enableHighDpiRendering = false;

  protected size: vec2;
  protected frameBuffer: WebGLFramebuffer;

  constructor(
    protected gl: WebGL2RenderingContext,
    protected programs: Array<FragmentShaderOnlyProgram>
  ) {}

  public render(uniforms: any, input?: WebGLTexture) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);

    if (input !== null) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, input);
    }

    this.gl.viewport(0, 0, this.size.x, this.size.y);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.programs.forEach((p) => {
      p.bind();
      p.setUniforms(uniforms);
      p.draw();
    });
  }

  public setSize() {
    const realToCssPixels = window.devicePixelRatio * this.renderScale;
    const canvasWidth = (this.gl.canvas as HTMLCanvasElement).clientWidth;
    const canvasHeight = (this.gl.canvas as HTMLCanvasElement).clientHeight;

    const displayWidth = Math.floor(canvasWidth * realToCssPixels);
    const displayHeight = Math.floor(canvasHeight * realToCssPixels);

    this.size = vec2.fromValues(displayWidth, displayHeight);
  }

  public getSize(): vec2 {
    return this.size;
  }
}
