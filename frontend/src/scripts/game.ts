import { vec2 } from 'gl-matrix';
import { CircleLight, compile, Flashlight, InvertedTunnel, Renderer } from 'sdf-2d';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { RenderCommand } from './graphics/commands/render';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { prettyPrint } from './helper/pretty-print';
import { rgb } from './helper/rgb';
import { IGame } from './i-game';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { Objects } from './objects/objects';
import { Camera } from './objects/types/camera';
import { Character } from './objects/types/character';
import { createDungeon } from './objects/world/create-dungeon';
import { BoundingBoxBase } from './physics/bounds/bounding-box-base';
import { MoveToCommand } from './physics/commands/move-to';
import { StepCommand } from './physics/commands/step';
import { TeleportToCommand } from './physics/commands/teleport-to';
import { Physics } from './physics/physics';
import { settings } from './settings';
import { BlobShape } from './shapes/types/blob-shape';

export class Game implements IGame {
  public readonly objects = new Objects();
  public readonly physics = new Physics();
  public readonly camera = new Camera();
  private character: Character;
  private renderer: Renderer;
  private rendererPromise: Promise<Renderer>;
  private overlay: HTMLElement = document.querySelector('#overlay');

  constructor() {
    const canvas: HTMLCanvasElement = document.querySelector('canvas#main');

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
        InvertedTunnel.descriptor,
        Flashlight.descriptor,
        BlobShape.descriptor,
        CircleLight.descriptor,
      ],
      {
        shadowTraceCount: 12,
        paletteSize: 10,
        enableStopwatch: true,
      }
    );
    this.initializeScene();
    this.physics.start();
  }

  public async start(): Promise<void> {
    this.renderer = await this.rendererPromise;
    this.renderer.setRuntimeSettings({
      isWorldInverted: true,
      ambientLight: rgb(0.35, 0.1, 0.45),
      colorPalette: [
        rgb(0.4, 1, 0.6),
        rgb(1, 1, 0),
        rgb(0.3, 1, 1),
        rgb(0.3, 1, 1),
        rgb(0.3, 1, 1),
        rgb(0.3, 1, 1),
        rgb(0.3, 1, 1),
      ],
      enableHighDpiRendering: false,
      lightCutoffDistance: settings.lightCutoffDistance,
    });
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public get viewArea(): BoundingBoxBase {
    return this.camera.viewArea;
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return this.physics.findIntersecting(box);
  }

  private initializeScene() {
    createDungeon(this.objects, this.physics);
    //createDungeon(this.objects, this.physics);

    this.character = new Character(this.physics, this);
    this.objects.addObject(this.character);
    this.objects.addObject(this.camera);
    let pos: any = localStorage.getItem('characterPosition');
    pos = pos ? JSON.parse(pos) : vec2.fromValues(0, 0);
    this.character.sendCommand(new TeleportToCommand(pos));
  }

  private deltaTimeCalculator = new DeltaTimeCalculator();

  private gameLoop(time: DOMHighResTimeStamp) {
    const deltaTime = this.deltaTimeCalculator.getNextDeltaTime(time);

    this.objects.sendCommand(new StepCommand(deltaTime));
    this.camera.sendCommand(new MoveToCommand(this.character.position));
    this.camera.sendCommand(new RenderCommand(this.renderer));

    const shouldBeDrawn = this.physics
      .findIntersecting(this.camera.viewArea)
      .map((b) => b.owner);

    for (const object of shouldBeDrawn) {
      object?.sendCommand(new RenderCommand(this.renderer));
    }

    this.renderer.renderDrawables();

    this.overlay.innerText = prettyPrint(this.renderer.insights);
    localStorage.setItem('characterPosition', JSON.stringify(this.character.position));
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
