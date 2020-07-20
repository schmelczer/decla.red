import { WebGl2Renderer } from './drawing/webgl2-renderer';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { ObjectContainer } from './objects/object-container';
import { DrawCommand } from './commands/types/draw';

import { StepCommand } from './commands/types/step';
import { Character } from './objects/types/character';
import { InfoText } from './objects/types/info-text';
import { timeIt } from './helper/timing';

import caveFragmentShader from '../shaders/cave-fs.glsl';
import { Dungeon } from './objects/types/dungeon';
import { BeforeDrawCommand } from './commands/types/before-draw';

export class Game {
  private previousTime: DOMHighResTimeStamp = 0;
  private objects: ObjectContainer = new ObjectContainer();
  private renderer: WebGl2Renderer;
  private previousFpsValues: Array<number> = [];

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');
    const overlay: HTMLElement = document.querySelector('#overlay');

    new CommandBroadcaster(
      [
        new KeyboardListener(document.body),
        new MouseListener(canvas),
        new TouchListener(canvas),
      ],
      [this.objects]
    );

    this.renderer = new WebGl2Renderer(canvas, overlay, [caveFragmentShader]);

    this.initializeScene();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private initializeScene() {
    this.objects.addObject(new Character(this.objects));
    this.objects.addObject(new InfoText());
    this.objects.addObject(new Dungeon());
  }

  @timeIt()
  private gameLoop(time: DOMHighResTimeStamp) {
    const deltaTime = time - this.previousTime;
    this.previousTime = time;
    this.calculateFps(deltaTime);

    this.objects.sendCommand(new StepCommand(deltaTime));

    this.renderer.startFrame();
    this.objects.sendCommand(new BeforeDrawCommand(this.renderer));
    this.objects.sendCommand(new DrawCommand(this.renderer));
    this.renderer.finishFrame();

    window.requestAnimationFrame(this.gameLoop.bind(this));
  }

  private calculateFps(deltaTime: number) {
    this.previousFpsValues.push(1000 / deltaTime);
    if (this.previousFpsValues.length > 30) {
      const text = `Min: ${this.previousFpsValues[0].toFixed(
        2
      )}\n\tMedian: ${this.previousFpsValues[
        Math.floor(this.previousFpsValues.length / 2)
      ].toFixed(2)}`;

      InfoText.modifyRecord('FPS', text);

      this.previousFpsValues = [];
    }
  }
}
