import * as twgl from 'twgl.js';

export class Renderer {
  private gl: WebGL2RenderingContext;
  private programInfo: any;
  private bufferInfo: any;
  private vao: any;

  constructor(private canvas: HTMLCanvasElement, shaderSources: Array<string>) {
    twgl.setDefaults({ attribPrefix: 'a_' });

    this.gl = this.canvas.getContext('webgl2');
    if (!this.gl) {
      throw new Error('WebGl2 not supported');
    }

    this.programInfo = twgl.createProgramInfo(this.gl, shaderSources);

    const arrays = {
      position: {
        numComponents: 3,
        data: [-1.0, -1.0, 0.0, -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0],
      },
      indices: {
        numComponents: 3,
        data: [0, 1, 2, 0, 2, 3],
      },
    };
    this.bufferInfo = twgl.createBufferInfoFromArrays(this.gl, arrays);
    this.vao = twgl.createVAOFromBufferInfo(
      this.gl,
      this.programInfo,
      this.bufferInfo
    );
  }

  start() {
    requestAnimationFrame(this.render.bind(this));
  }

  private render(time: number) {
    const gl = this.gl;

    twgl.resizeCanvasToDisplaySize(this.canvas);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    const uniforms = {
      /*time: time * 0.001,
            resolution: [this.gl.canvas.width, this.gl.canvas.height],*/
    };

    this.gl.useProgram(this.programInfo.program);
    this.gl.bindVertexArray(this.vao);
    //twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);

    twgl.setUniforms(this.programInfo, uniforms);
    twgl.drawBufferInfo(this.gl, this.bufferInfo);

    requestAnimationFrame(this.render.bind(this));
  }
}
