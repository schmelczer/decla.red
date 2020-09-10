const extensions: Map<string, any> = new Map();

export const tryEnableExtension = (
  gl: WebGL2RenderingContext,
  name: string
): any | null => {
  if (extensions.has(name)) {
    return extensions.get(name);
  }

  let extension = null;
  if (gl.getSupportedExtensions().indexOf(name) != -1) {
    extension = gl.getExtension(name);
  }

  extensions.set(name, extension);

  return extension;
};

export const enableExtension = (gl: WebGL2RenderingContext, name: string): any => {
  const extension = tryEnableExtension(gl, name);

  if (extension === null) {
    throw new Error(`Unsupported extension ${name}`);
  }

  return extension;
};
