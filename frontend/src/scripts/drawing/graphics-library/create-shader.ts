export const createShader = (
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!success) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
};
