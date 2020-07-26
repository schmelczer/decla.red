import { IProgram } from '../program/i-program';
import { FrameBuffer } from './frame-buffer';

export class DefaultFrameBuffer extends FrameBuffer {
  constructor(gl: WebGL2RenderingContext, programs: Array<IProgram>) {
    super(gl, programs);
    this.frameBuffer = null;

    this.setSize();
  }

  public setSize() {
    super.setSize();

    if (
      this.gl.canvas.width !== this.size.x ||
      this.gl.canvas.height !== this.size.y
    ) {
      this.gl.canvas.width = this.size.x;
      this.gl.canvas.height = this.size.y;
    }
  }
}
