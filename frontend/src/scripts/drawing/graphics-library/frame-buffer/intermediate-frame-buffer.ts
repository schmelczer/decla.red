import { IProgram } from '../program/i-program';
import { FrameBuffer } from './frame-buffer';

export class IntermediateFrameBuffer extends FrameBuffer {
  private frameTexture: WebGLTexture;

  constructor(gl: WebGL2RenderingContext, programs: Array<IProgram>) {
    super(gl, programs);

    this.frameTexture = this.gl.createTexture();
    this.configureTexture();

    this.frameBuffer = this.gl.createFramebuffer();
    this.configureFrameBuffer();

    this.setSize();
  }

  public get colorTexture(): WebGLTexture {
    return this.frameTexture;
  }

  public setSize() {
    super.setSize();

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.size.x,
      this.size.y,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
  }

  private configureTexture() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
  }

  private configureFrameBuffer() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
    const attachmentPoint = this.gl.COLOR_ATTACHMENT0;
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      attachmentPoint,
      this.gl.TEXTURE_2D,
      this.frameTexture,
      0
    );
  }
}
