import caveFragmentShader from '../shaders/cave-distance-fs.glsl';
import lightsShader from '../shaders/lights-shading-fs.glsl';
import caveVertexShader from '../shaders/passthrough-distance-vs.glsl';
import lightsVertexShader from '../shaders/passthrough-shading-vs.glsl';
// import lightsShader from '../shaders/rainbow-shading-fs.glsl';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { BeforeDrawCommand } from './commands/types/before-draw';
import { DrawCommand } from './commands/types/draw';
import { StepCommand } from './commands/types/step';
import { WebGl2Renderer } from './drawing/webgl2-renderer';
import { timeIt } from './helper/timing';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { ObjectContainer } from './objects/object-container';
import { InfoText } from './objects/types/info-text';
import { createCharacter } from './objects/world/create-character';
import { createDungeon } from './objects/world/create-dungeon';

export class Game {
  private previousTime?: DOMHighResTimeStamp = null;
  private objects: ObjectContainer = new ObjectContainer();
  private renderer: WebGl2Renderer;
  private previousFpsValues: Array<number> = [];

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');
    const overlay: HTMLElement = document.querySelector('#overlay');

    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange.bind(this)
    );

    new CommandBroadcaster(
      [
        new KeyboardListener(document.body),
        new MouseListener(canvas),
        new TouchListener(canvas),
      ],
      [this.objects]
    );

    this.renderer = new WebGl2Renderer(canvas, overlay, [
      [caveVertexShader, caveFragmentShader],
      [lightsVertexShader, lightsShader],
    ]);

    this.initializeScene();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private initializeScene() {
    this.objects.addObject(new InfoText());
    createCharacter(this.objects);
    createDungeon(this.objects);
  }

  private handleVisibilityChange() {
    if (!document.hidden) {
      this.previousTime = null;
    }
  }

  @timeIt()
  private gameLoop(time: DOMHighResTimeStamp) {
    if (this.previousTime === null) {
      this.previousTime = time;
    }

    const deltaTime = time - this.previousTime;
    this.previousTime = time;
    this.calculateFps(deltaTime);

    this.objects.sendCommand(new StepCommand(deltaTime));

    this.renderer.startFrame(deltaTime);
    this.objects.sendCommand(new BeforeDrawCommand(this.renderer));
    this.objects.sendCommand(new DrawCommand(this.renderer));
    this.renderer.finishFrame();

    window.requestAnimationFrame(this.gameLoop.bind(this));
  }

  private calculateFps(deltaTime: number) {
    this.previousFpsValues.push(1000 / deltaTime);
    if (this.previousFpsValues.length > 30) {
      this.previousFpsValues.sort();
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
