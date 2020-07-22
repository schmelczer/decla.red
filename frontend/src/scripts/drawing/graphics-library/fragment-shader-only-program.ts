import passthroughVertexShader from '../../../shaders/passthrough-vs.glsl';
import { createShader } from './create-shader';
import { loadUniform } from './load-uniform';

export class FragmentShaderOnlyProgram {
  program: WebGLProgram;
  shaders: Array<WebGLShader> = [];

  private vao: WebGLVertexArrayObject;
  private uniforms: Array<{
    name: Array<string>;
    location: WebGLUniformLocation;
    type: GLenum;
  }> = [];

  constructor(
    private gl: WebGL2RenderingContext,
    fragmentShaderSource: string
  ) {
    this.createProgram(fragmentShaderSource);
    this.prepareScreenQuad('a_position');
    this.queryUniforms();
  }

  public bind() {
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
  }

  public draw() {
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  public setUniforms(values: any) {
    this.uniforms.forEach(({ name, location, type }) => {
      const value = name.reduce(
        (prev, prop) => (prev !== null && prop in prev ? prev[prop] : null),
        values
      );

      if (value !== null) {
        loadUniform(this.gl, value, type, location);
      }
    });
  }

  private queryUniforms() {
    const uniformCount = this.gl.getProgramParameter(
      this.program,
      WebGL2RenderingContext.ACTIVE_UNIFORMS
    );

    for (let i = 0; i < uniformCount; i++) {
      const glUniform = this.gl.getActiveUniform(this.program, i);

      this.uniforms.push({
        name: glUniform.name.split(/\[|\]\.|\]|\./).filter((p) => p !== ''),
        location: this.gl.getUniformLocation(this.program, glUniform.name),
        type: glUniform.type,
      });
    }

    console.log(this.uniforms);

    this.uniforms.map((u1) => {
      const isSingle =
        this.uniforms.filter((u2) => u2.name.includes(u1.name[0])).length == 1;
      if (u1.name.includes('0') && isSingle) {
        u1.name = u1.name.slice(0, -1);
      }
      return u1;
    });

    console.log(this.uniforms);
  }

  private createProgram(fragmentShaderSource: string) {
    this.program = this.gl.createProgram();

    const vertexShader = createShader(
      this.gl,
      this.gl.VERTEX_SHADER,
      passthroughVertexShader
    );
    this.gl.attachShader(this.program, vertexShader);
    this.shaders.push(vertexShader);

    const fragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource
    );
    this.gl.attachShader(this.program, fragmentShader);
    this.shaders.push(fragmentShader);

    this.gl.linkProgram(this.program);

    const success = this.gl.getProgramParameter(
      this.program,
      this.gl.LINK_STATUS
    );
    if (!success) {
      throw new Error(this.gl.getProgramInfoLog(this.program));
    }
  }

  private prepareScreenQuad(attributeName: string) {
    const positionAttributeLocation = this.gl.getAttribLocation(
      this.program,
      attributeName
    );

    const positionBuffer = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
      this.gl.STATIC_DRAW
    );
    this.vao = this.gl.createVertexArray();

    this.gl.bindVertexArray(this.vao);
    this.gl.enableVertexAttribArray(positionAttributeLocation);
    this.gl.vertexAttribPointer(
      positionAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }
}
