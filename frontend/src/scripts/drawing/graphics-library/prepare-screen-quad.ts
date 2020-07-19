export const prepareScreenQuad = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  attributeName: string
): WebGLVertexArrayObject => {
  const positionAttributeLocation = gl.getAttribLocation(
    program,
    attributeName
  );

  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
    gl.STATIC_DRAW
  );
  const vao = gl.createVertexArray();

  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  return vao;
};
