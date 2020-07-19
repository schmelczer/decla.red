import { WebGl2Renderer } from './drawing/renderer';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { ObjectContainer } from './objects/object-container';
import { DrawCommand } from './commands/types/draw';
import passthroughVertexShader from '../shaders/passthrough.vert';
import distanceFragmentShader from '../shaders/dist.frag';
import { StepCommand } from './commands/types/step';
import { Character } from './objects/types/character';
import { InfoText } from './objects/types/info-text';
import { timeIt } from './helper/timing';

export class Game {
  private previousTime: DOMHighResTimeStamp = 0;
  private objects: ObjectContainer = new ObjectContainer();
  private renderer: WebGl2Renderer;

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

    this.renderer = new WebGl2Renderer(canvas, overlay, [
      passthroughVertexShader,
      distanceFragmentShader,
    ]);

    this.initializeScene();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private initializeScene() {
    this.objects.addObject(new Character(this.objects));
    this.objects.addObject(new InfoText());
  }

  @timeIt()
  private gameLoop(time: DOMHighResTimeStamp) {
    const deltaTime = time - this.previousTime;
    this.previousTime = time;

    this.objects.sendCommand(new StepCommand(deltaTime));

    this.renderer.startWaitingForInstructions();
    this.objects.sendCommand(new DrawCommand(this.renderer));
    this.renderer.finishWaitingForInstructions();

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
