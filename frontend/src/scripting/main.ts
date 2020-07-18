import { Renderer } from './drawing/renderer';
import { KeyboardListener } from './helper/keyboard-listener';

import passthroughVertexShader from '../shaders/passthrough.vert';
import distanceFragmentShader from '../shaders/dist.frag';

export const main = async () => {
  try {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');

    const renderer = new Renderer(canvas, [
      passthroughVertexShader,
      distanceFragmentShader,
    ]);

    renderer.start();
  } catch (e) {
    console.error(e);
  }
};
