import { settings } from '../../settings';

export const createShader = (
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
  substitutions: { [name: string]: string }
): WebGLShader => {
  const allSubstitutions = { ...settings.shaderMacros, ...substitutions };

  source = source.replace(/{(.+)}/gm, (_, name: string): string => {
    const value = allSubstitutions[name];
    return Number.isInteger(value) ? `${value}.0` : value;
  });

  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!success) {
    throw new Error(gl.getShaderInfoLog(shader));
  }

  return shader;
};
