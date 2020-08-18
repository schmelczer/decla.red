export const enableExtension = (gl: WebGL2RenderingContext, name: string): any => {
  if (gl.getSupportedExtensions().indexOf(name) == -1) {
    throw new Error(`Unsupported extension ${name}`);
  }

  return gl.getExtension(name);
};
