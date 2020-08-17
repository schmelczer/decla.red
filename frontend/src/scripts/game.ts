import { CommandBroadcaster } from './commands/command-broadcaster';
import { BeforeRenderCommand } from './drawing/commands/before-render';
import { StepCommand } from './physics/commands/step';
import { WebGl2Renderer } from './drawing/rendering/webgl2-renderer';
import { timeIt } from './helper/timing';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { Objects } from './objects/objects';
import { InfoText } from './objects/types/info-text';
import { createCharacter } from './objects/world/create-character';
import { createDungeon } from './objects/world/create-dungeon';
import { RenderCommand } from './drawing/commands/render';
import { Physics } from './physics/physics';
import { TeleportToCommand } from './physics/commands/teleport-to';
import { IRenderer } from './drawing/i-renderer';
import { Random } from './helper/random';

export class Game {
  private previousTime?: DOMHighResTimeStamp = null;
  private objects = new Objects();
  private physics = new Physics();

  private renderer: IRenderer;
  private previousFpsValues: Array<number> = [];

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');
    const overlay: HTMLElement = document.querySelector('#overlay');

    Random.seed = 42;

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

    this.renderer = new WebGl2Renderer(canvas, overlay);

    this.initializeScene();
    this.physics.start();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private initializeScene() {
    this.objects.addObject(new InfoText());
    const start = createDungeon(this.objects, this.physics);
    createDungeon(this.objects, this.physics);
    const character = createCharacter(this.objects, this.physics);
    console.log('start', start.from);
    character.sendCommand(new TeleportToCommand(start.from));
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
    this.objects.sendCommand(new BeforeRenderCommand(this.renderer));
    this.objects.sendCommand(new RenderCommand(this.renderer));
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
