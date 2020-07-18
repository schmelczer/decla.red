import * as twgl from 'twgl.js';
import { TimeIt } from '../helper/timing';
import { KeyboardListener } from '../helper/keyboard-listener';
import { Vec2 } from '../shared/vec2';

export class Renderer {
  private gl: WebGL2RenderingContext;
  private programInfo: any;
  private bufferInfo: any;
  private vao: any;
  private cameraPosition: Vec2 = { x: 0, y: 0 };
  private keys: KeyboardListener = new KeyboardListener();

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
    requestAnimationFrame(this.timedRender);
  }

  private timedRender = TimeIt(this.render.bind(this), 240);

  private render(time: number) {
    const gl = this.gl;

    twgl.resizeCanvasToDisplaySize(this.canvas);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.keys.isKeyDown('w')) {
      this.cameraPosition.y += 10;
    }

    if (this.keys.isKeyDown('s')) {
      this.cameraPosition.y -= 10;
    }

    if (this.keys.isKeyDown('a')) {
      this.cameraPosition.x -= 10;
    }

    if (this.keys.isKeyDown('d')) {
      this.cameraPosition.x += 10;
    }

    const uniforms = {
      cameraPosition: [this.cameraPosition.x, this.cameraPosition.y],
      viewBoxSize: [this.gl.canvas.width, this.gl.canvas.height],
      resolution: [this.gl.canvas.width, this.gl.canvas.height],
    };

    this.gl.useProgram(this.programInfo.program);
    this.gl.bindVertexArray(this.vao);
    //twgl.setBuffersAndAttributes(this.gl, this.programInfo, this.bufferInfo);

    twgl.setUniforms(this.programInfo, uniforms);
    twgl.drawBufferInfo(this.gl, this.bufferInfo);

    requestAnimationFrame(this.timedRender);
  }
}
