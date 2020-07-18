const twgl = require('twgl.js');

import { TimeIt } from '../helper/timing';
import { Vec2 } from '../math/vec2';
import { ObjectContainer } from '../objects/object-container';

export class Renderer {
  private gl: WebGL2RenderingContext;
  private programInfo: any;
  private bufferInfo: any;
  private vao: any;

  constructor(
    private canvas: HTMLCanvasElement,
    private objects: ObjectContainer,
    shaderSources: Array<string>
  ) {
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

  public render(time: number) {
    const gl = this.gl;

    twgl.resizeCanvasToDisplaySize(this.canvas);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    const uniforms = {
      cameraPosition: this.objects.camera.position.list,
      viewBoxSize: [this.gl.canvas.width, this.gl.canvas.height],
      resolution: [this.gl.canvas.width, this.gl.canvas.height],
    };

    this.gl.useProgram(this.programInfo.program);
    this.gl.bindVertexArray(this.vao);
    //twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);

    twgl.setUniforms(this.programInfo, uniforms);
    twgl.drawBufferInfo(this.gl, this.bufferInfo);
  }
}
