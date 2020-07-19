import { createShader } from './create-shader';

export const createProgram = (
  gl: WebGL2RenderingContext,
  vertexShader: string,
  fragmentShader: string
): WebGLProgram => {
  const program = gl.createProgram();

  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShader));
  gl.attachShader(
    program,
    createShader(gl, gl.FRAGMENT_SHADER, fragmentShader)
  );
  gl.linkProgram(program);

  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
};
