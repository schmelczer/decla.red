import { waitWhileFalse } from '../../../helper/wait-for';
import { tryEnableExtension } from '../helper/enable-extension';
import { checkProgram } from './check-program';
import { createShader } from './create-shader';

export const createProgram = async (
  gl: WebGL2RenderingContext,
  vertexShaderSource: string,
  fragmentShaderSource: string,
  substitutions: { [name: string]: string }
): Promise<WebGLProgram> => {
  const program = gl.createProgram();

  const extension = tryEnableExtension(gl, 'KHR_parallel_shader_compile');

  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    vertexShaderSource,
    substitutions
  );
  gl.attachShader(program, vertexShader);

  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
    substitutions
  );
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  if (extension) {
    const checkCompileStatus = () =>
      gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR);

    await waitWhileFalse(checkCompileStatus);
  }

  checkProgram(gl, program);

  return program;
};
