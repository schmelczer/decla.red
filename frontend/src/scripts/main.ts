import { Renderer } from './drawing/renderer';

import passthroughVertexShader from '../shaders/passthrough.vert';
import distanceFragmentShader from '../shaders/dist.frag';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { GameLogic } from './game-logic/game-logic';
import { GameObject } from './objects/game-object';
import { ObjectContainer } from './objects/object-container';
import { Camera } from './objects/types/camera';

const startGameLoop = (gameLogic: GameLogic, renderer: Renderer) => {
  const loop = (time: DOMHighResTimeStamp) => {
    gameLogic.step(time);
    renderer.render(time);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

export const main = async () => {
  try {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');

    const objects = new ObjectContainer(new Camera());

    const gameLogic = new GameLogic(objects);
    new CommandBroadcaster(
      [
        new KeyboardListener(document.body),
        new MouseListener(canvas),
        new TouchListener(canvas),
      ],
      [gameLogic]
    );

    const renderer = new Renderer(canvas, objects, [
      passthroughVertexShader,
      distanceFragmentShader,
    ]);

    startGameLoop(gameLogic, renderer);
  } catch (e) {
    console.error(e);
  }
};
