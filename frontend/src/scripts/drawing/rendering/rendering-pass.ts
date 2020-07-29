import { IProgram } from '../graphics-library/program/i-program';
import { FrameBuffer } from '../graphics-library/frame-buffer/frame-buffer';

export class RenderingPass {
  constructor(private program: IProgram, private frame: FrameBuffer) {}

  public render(uniforms: any, inputTexture?: WebGLTexture) {}
}
