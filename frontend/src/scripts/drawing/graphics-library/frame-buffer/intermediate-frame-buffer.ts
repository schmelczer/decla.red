import { FrameBuffer } from './frame-buffer';
import { enableExtension } from '../helper/enable-extension';

export class IntermediateFrameBuffer extends FrameBuffer {
  private frameTexture: WebGLTexture;

  private floatLinearEnabled = true;

  constructor(gl: WebGL2RenderingContext) {
    super(gl);

    enableExtension(gl, 'EXT_color_buffer_float');

    try {
      enableExtension(gl, 'OES_texture_float_linear');
    } catch {
      this.floatLinearEnabled = false;
    }

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
      this.gl.RG16F,
      this.size.x,
      this.size.y,
      0,
      this.gl.RG,
      this.gl.FLOAT,
      null
    );
  }

  private configureTexture() {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.floatLinearEnabled ? this.gl.LINEAR : this.gl.NEAREST
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.floatLinearEnabled ? this.gl.LINEAR : this.gl.NEAREST
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
