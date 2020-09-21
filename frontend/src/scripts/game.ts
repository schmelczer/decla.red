import { vec3 } from 'gl-matrix';
import { CircleLight, compile, Flashlight, Renderer } from 'sdf-2d';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { RenderCommand } from './graphics/commands/render';
import { prettyPrint } from './helper/pretty-print';
import { IGame } from './i-game';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { GameObject } from './objects/game-object';
import { Objects } from './objects/objects';
import { Camera } from './objects/types/camera';
import { Character } from './objects/types/character';
import { createDungeon } from './objects/world/create-dungeon';
import { MoveToCommand } from './physics/commands/move-to';
import { StepCommand } from './physics/commands/step';
import { TeleportToCommand } from './physics/commands/teleport-to';
import { Physics } from './physics/physics';
import { BoundingBoxBase } from './shapes/bounding-box-base';
import { CircleShape } from './shapes/types/circle-shape';
import { TunnelShape } from './shapes/types/tunnel-shape';

export class Game implements IGame {
  public readonly objects = new Objects();
  public readonly physics = new Physics();
  public readonly camera = new Camera();
  private previousTime?: DOMHighResTimeStamp = null;
  private previousFpsValues: Array<number> = [];
  private character: Character;
  private renderer: Renderer;
  private rendererPromise: Promise<Renderer>;
  private overlay: HTMLElement = document.querySelector('#overlay');

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');

    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    new CommandBroadcaster(
      [
        new KeyboardListener(document.body),
        new MouseListener(canvas),
        new TouchListener(canvas),
      ],
      [this.objects]
    );

    this.rendererPromise = compile(
      canvas,
      [
        CircleShape.descriptor,
        TunnelShape.descriptor,
        Flashlight.descriptor,
        CircleLight.descriptor,
      ],
      [
        vec3.fromValues(0, 0, 0),
        vec3.fromValues(224 / 255, 96 / 255, 126 / 255),
        vec3.fromValues(119 / 255, 173 / 255, 120 / 255),
      ]
    );
    this.initializeScene();
    this.physics.start();
  }

  public async start(): Promise<void> {
    this.renderer = await this.rendererPromise;
    this.renderer.setRuntimeSettings({
      isWorldInverted: true,
      ambientLight: vec3.fromValues(0.35, 0.1, 0.45),
      shadowLength: 300,
    });
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

  private gameLoop(time: DOMHighResTimeStamp) {
    if (this.previousTime === null) {
      this.previousTime = time;
    }

    const deltaTime = time - this.previousTime;
    this.previousTime = time;

    this.objects.sendCommand(new StepCommand(deltaTime));
    this.camera.sendCommand(new MoveToCommand(this.character.position));

    this.camera.sendCommand(new RenderCommand(this.renderer));

    const shouldBeDrawn = this.physics
      .findIntersecting(this.camera.viewArea)
      .map((b) => b.shape?.gameObject);

    for (const object of shouldBeDrawn) {
      object?.sendCommand(new RenderCommand(this.renderer));
    }

    this.character.sendCommand(new RenderCommand(this.renderer));
    this.renderer.renderDrawables();

    this.overlay.innerText = prettyPrint(this.renderer.insights);

    localStorage.setItem('character-position', JSON.stringify(this.character.position));
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
