import { mat2d, vec2 } from 'gl-matrix';
import { createShader } from '../helper/create-shader';
import { loadUniform } from '../helper/load-uniform';
import { IProgram } from './i-program';

export abstract class Program implements IProgram {
  protected program: WebGLProgram;
  private shaders: Array<WebGLShader> = [];
  private modelTransform = mat2d.identity(mat2d.create());
  private readonly ndcToUv: mat2d;

  private uniforms: Array<{
    name: Array<string>;
    location: WebGLUniformLocation;
    type: GLenum;
  }> = [];

  constructor(
    protected gl: WebGL2RenderingContext,
    [vertexShaderSource, fragmentShaderSource]: [string, string],
    substitutions: { [name: string]: string }
  ) {
    this.createProgram(vertexShaderSource, fragmentShaderSource, substitutions);
    this.queryUniforms();

    this.ndcToUv = mat2d.fromScaling(mat2d.create(), vec2.fromValues(0.5, 0.5));
    mat2d.translate(this.ndcToUv, this.ndcToUv, vec2.fromValues(1, 1));
  }

  public bindAndSetUniforms(values: { [name: string]: any }) {
    this.bind();
    this.setUniforms({ modelTransform: this.modelTransform, ...values });
  }

  public setDrawingRectangle(bottomLeft: vec2, size: vec2) {
    mat2d.invert(this.modelTransform, this.ndcToUv);
    mat2d.translate(this.modelTransform, this.modelTransform, bottomLeft);
    mat2d.scale(this.modelTransform, this.modelTransform, size);
    mat2d.multiply(this.modelTransform, this.modelTransform, this.ndcToUv);
  }

  public setUniforms(values: { [name: string]: any }) {
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

  public delete() {
    this.shaders.forEach((s) => this.gl.deleteShader(s));
    this.gl.deleteProgram(this.program);
  }

  public abstract draw(): void;

  protected bind() {
    this.gl.useProgram(this.program);
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

    this.uniforms.map((u1) => {
      const isSingle =
        this.uniforms.filter((u2) => u2.name.includes(u1.name[0])).length == 1;
      if (u1.name.includes('0') && isSingle) {
        u1.name = u1.name.slice(0, -1);
      }
      return u1;
    });
  }

  private createProgram(
    passthroughVertexShaderSource: string,
    fragmentShaderSource: string,
    substitutions: { [name: string]: string }
  ) {
    this.program = this.gl.createProgram();

    const vertexShader = createShader(
      this.gl,
      this.gl.VERTEX_SHADER,
      passthroughVertexShaderSource,
      substitutions
    );
    this.gl.attachShader(this.program, vertexShader);
    this.shaders.push(vertexShader);

    const fragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
      substitutions
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
}
