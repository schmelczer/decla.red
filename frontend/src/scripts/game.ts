import { CommandBroadcaster } from './commands/command-broadcaster';
import { BeforeRenderCommand } from './drawing/commands/before-render';
import { RenderCommand } from './drawing/commands/render';
import { IRenderer } from './drawing/i-renderer';
import { WebGl2Renderer } from './drawing/rendering/webgl2-renderer';
import { timeIt } from './helper/timing';
import { IGame } from './i-game';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { GameObject } from './objects/game-object';
import { Objects } from './objects/objects';
import { Camera } from './objects/types/camera';
import { Character } from './objects/types/character';
import { InfoText } from './objects/types/info-text';
import { createDungeon } from './objects/world/create-dungeon';
import { MoveToCommand } from './physics/commands/move-to';
import { StepCommand } from './physics/commands/step';
import { TeleportToCommand } from './physics/commands/teleport-to';
import { Physics } from './physics/physics';
import { BoundingBoxBase } from './shapes/bounding-box-base';

export class Game implements IGame {
  public readonly objects = new Objects();
  public readonly physics = new Physics();
  public readonly camera = new Camera();
  private previousTime?: DOMHighResTimeStamp = null;
  private previousFpsValues: Array<number> = [];
  private infoText = new InfoText();
  private character: Character;
  private renderer: IRenderer;
  private initializeRendererPromise: Promise<void>;

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');
    const overlay: HTMLElement = document.querySelector('#overlay');

    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    new CommandBroadcaster(
      [
        new KeyboardListener(document.body),
        new MouseListener(canvas),
        new TouchListener(canvas),
      ],
      [this.objects]
    );

    this.renderer = new WebGl2Renderer(canvas, overlay);
    this.initializeRendererPromise = this.renderer.initialize();
    this.initializeScene();
    this.physics.start();
  }

  public async start(): Promise<void> {
    await this.initializeRendererPromise;
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public addObject(o: GameObject) {
    this.objects.addObject(o);
  }

  public get viewArea(): BoundingBoxBase {
    return this.camera.viewArea;
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return this.physics.findIntersecting(box);
  }

  private initializeScene() {
    this.objects.addObject(this.infoText);

    const start = createDungeon(this.objects, this.physics);
    createDungeon(this.objects, this.physics);

    this.character = new Character(this);
    // this.physics.addDynamicBoundingBox(this.character.boundingBox);
    this.addObject(this.character);
    this.addObject(this.camera);
    let pos: any = localStorage.getItem('character-position');
    pos = pos ? JSON.parse(pos) : start.from;
    this.character.sendCommand(new TeleportToCommand(pos));
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
    this.camera.sendCommand(new MoveToCommand(this.character.position));

    this.renderer.startFrame(deltaTime);

    this.camera.sendCommand(new BeforeRenderCommand(this.renderer));

    const shouldBeDrawn = this.physics
      .findIntersecting(this.camera.viewArea)
      .map((b) => b.shape?.gameObject);

    for (const object of shouldBeDrawn) {
      object?.sendCommand(new BeforeRenderCommand(this.renderer));
      object?.sendCommand(new RenderCommand(this.renderer));
    }

    this.character.sendCommand(new RenderCommand(this.renderer));
    this.infoText.sendCommand(new RenderCommand(this.renderer));
    this.renderer.finishFrame();

    localStorage.setItem('character-position', JSON.stringify(this.character.position));
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
