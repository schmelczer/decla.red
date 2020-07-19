const twgl = require('twgl.js');

import { Drawer } from './drawer';
import { Vec2 } from '../math/vec2';

export class WebGl2Renderer implements Drawer {
  private gl: WebGL2RenderingContext;
  private programInfo: any;
  private bufferInfo: any;
  private vao: any;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
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

  startWaitingForInstructions() {
    //throw new Error("Method not implemented.");
  }

  private cameraPosition: Vec2;
  private viewBoxSize: Vec2;

  finishWaitingForInstructions() {
    const gl = this.gl;

    twgl.resizeCanvasToDisplaySize(this.canvas);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    const uniforms = {
      cameraPosition: this.cameraPosition.list,
      viewBoxSize: this.viewBoxSize.list,
      resolution: [this.gl.canvas.width, this.gl.canvas.height],
    };

    this.gl.useProgram(this.programInfo.program);
    this.gl.bindVertexArray(this.vao);
    //twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);

    twgl.setUniforms(this.programInfo, uniforms);
    twgl.drawBufferInfo(this.gl, this.bufferInfo);
  }

  setCameraPosition(position: Vec2) {
    this.cameraPosition = position;
  }

  setViewBoxSize(size: Vec2) {
    this.viewBoxSize = size;
  }

  drawCornerText(text: string) {
    if (this.overlay.innerText != text) {
      this.overlay.innerText = text;
    }
  }
}
