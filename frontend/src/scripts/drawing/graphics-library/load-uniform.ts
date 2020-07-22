import { Vec2 } from '../../math/vec2';
import { Mat3 } from '../../math/mat3';

export const loadUniform = (
  gl: WebGL2RenderingContext,
  value: any,
  type: GLenum,
  location: WebGLUniformLocation
): any => {
  const converters: Map<
    GLenum,
    (
      gl: WebGL2RenderingContext,
      value: any,
      location: WebGLUniformLocation
    ) => void
  > = new Map();
  {
    converters.set(WebGL2RenderingContext.FLOAT, (gl, v, l) => {
      gl.uniform1fv(l, new Float32Array(v));
    });

    converters.set(
      WebGL2RenderingContext.FLOAT_VEC2,
      (gl, v: Vec2 | Array<Vec2>, l) => {
        if (v instanceof Array) {
          const result = new Float32Array(v.length * 2);
          for (let i = 0; i < v.length; i++) {
            result[2 * i] = v[i].x;
            result[2 * i + 1] = v[i].y;
          }
          gl.uniform2fv(l, new Float32Array(result));
        } else {
          gl.uniform2fv(l, new Float32Array(v.list));
        }
      }
    );

    converters.set(WebGL2RenderingContext.FLOAT_MAT3, (gl, v: Mat3, l) =>
      gl.uniformMatrix3fv(l, false, new Float32Array(v.transposedFlat))
    );

    converters.set(WebGL2RenderingContext.BOOL, (gl, v, l) =>
      gl.uniform1i(l, v)
    );

    if (!converters.has(type)) {
      throw new Error('Unimplemented webgl type');
    }

    converters.get(type)(gl, value, location);
  }
};
