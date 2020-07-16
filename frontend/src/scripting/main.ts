import { Renderer } from './drawing/renderer';

import passthroughVertexShader from '../shaders/passthrough.vert';
import distanceFragmentShader from '../shaders/dist.frag';


export const main = () => {
    try {
        const canvas: HTMLCanvasElement = document.querySelector('canvas#main');
        const renderer = new Renderer(canvas, [passthroughVertexShader, distanceFragmentShader]);
        renderer.start();
    } catch (e) {
        console.error(e);
    }

};
