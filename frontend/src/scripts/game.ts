import { vec2 } from 'gl-matrix';
import {
  Circle,
  CircleLight,
  compile,
  FilteringOptions,
  Flashlight,
  InvertedTunnel,
  Renderer,
  renderNoise,
  WrapOptions,
} from 'sdf-2d';
import { CommandBroadcaster } from './commands/command-broadcaster';
import { MoveToCommand } from './commands/move-to';
import { RenderCommand } from './commands/render';
import { StepCommand } from './commands/step';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { prettyPrint } from './helper/pretty-print';
import { rgb } from './helper/rgb';
import { IGame } from './i-game';
import { KeyboardListener } from './input/keyboard-listener';
import { MouseListener } from './input/mouse-listener';
import { TouchListener } from './input/touch-listener';
import { GameObject } from './objects/game-object';
import { Objects } from './objects/objects';
import { Camera } from './objects/types/camera';
import { Character } from './objects/types/character';
import { createDungeon } from './objects/world/create-dungeon';
import { BoundingBoxBase } from './physics/bounds/bounding-box-base';
import { Physics } from './physics/physics';
import { settings } from './settings';
import { BlobShape } from './shapes/blob-shape';

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
        {
          ...InvertedTunnel.descriptor,
          shaderCombinationSteps: [0, 2, 4, 8, 16],
        },
        {
          ...BlobShape.descriptor,
          shaderCombinationSteps: [0, 1],
        },
        {
          ...Circle.descriptor,
          shaderCombinationSteps: [0, 2, 4, 8, 16],
        },
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 1, 2, 4, 8],
        },
        {
          ...Flashlight.descriptor,
          shaderCombinationSteps: [0, 1],
        },
      ],
      {
        shadowTraceCount: 12,
        paletteSize: 10,
        enableStopwatch: true,
      }
    );
  }

  public async start(): Promise<void> {
    const noiseTexture = await renderNoise([1024, 1], 60, 1 / 8);

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
      textures: {
        noiseTexture: {
          source: noiseTexture,
          overrides: {
            maxFilter: FilteringOptions.LINEAR,
            wrapS: WrapOptions.MIRRORED_REPEAT,
          },
        },
      },
    });
    this.initializeScene();
    this.physics.start();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public get viewArea(): BoundingBoxBase {
    return this.camera.viewArea;
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return this.physics.findIntersecting(box);
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    return this.renderer.displayToWorldCoordinates(p);
  }

  private initializeScene() {
    createDungeon(this.objects, this.physics);
    createDungeon(this.objects, this.physics);
    createDungeon(this.objects, this.physics);
    createDungeon(this.objects, this.physics);

    this.character = new Character(this.physics, this);
    this.objects.addObject(this.character);
    this.objects.addObject(this.camera);
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
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public addObject(o: GameObject) {
    this.objects.addObject(o);
  }

  public removeObject(o: GameObject) {
    this.objects.removeObject(o);
  }
}
