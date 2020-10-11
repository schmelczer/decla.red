import { vec2 } from 'gl-matrix';
import {
  Circle,
  CircleLight,
  compile,
  FilteringOptions,
  Flashlight,
  InvertedTunnel,
  PolygonFactory,
  Renderer,
  renderNoise,
  WrapOptions,
} from 'sdf-2d';
import {
  broadcastCommands,
  deserialize,
  prettyPrint,
  serialize,
  settings,
  StepCommand,
  TransportEvents,
  SetAspectRatioActionCommand,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/generators/keyboard-listener';
import { MouseListener } from './commands/generators/mouse-listener';
import { TouchListener } from './commands/generators/touch-listener';
import { CommandReceiverSocket } from './commands/receivers/command-receiver-socket';
import { RenderCommand } from './commands/types/render';

import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { rgb } from './helper/rgb';

import { GameObjectContainer } from './objects/game-object-container';
import { BlobShape } from './shapes/blob-shape';

const Polygon = PolygonFactory(20);
export class Game {
  public readonly gameObjects = new GameObjectContainer(this);
  private readonly canvas: HTMLCanvasElement = document.querySelector(
    'canvas#main',
  ) as HTMLCanvasElement;
  private renderer!: Renderer;
  private socket!: SocketIOClient.Socket;
  private deltaTimeCalculator = new DeltaTimeCalculator();
  private overlay: HTMLElement = document.querySelector('#overlay') as HTMLDivElement;

  private async setupCommunication(): Promise<void> {
    // await Configuration.initialize();

    this.socket = io(
      'http://localhost:3000',
      /*Configuration.servers[1],*/ {
        reconnectionDelayMax: 10000,
        transports: ['websocket'],
      },
    );

    this.socket.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serialized: string) => {
      const command = deserialize(serialized);
      this.gameObjects.sendCommand(command);
    });

    this.socket.on(TransportEvents.Ping, () => {
      this.socket.emit(TransportEvents.Pong);
    });

    this.socket.emit(TransportEvents.PlayerJoining, null);

    broadcastCommands(
      [
        new KeyboardListener(document.body),
        new MouseListener(this.canvas, this),
        new TouchListener(this.canvas, this),
      ],
      [this.gameObjects, new CommandReceiverSocket(this.socket)],
    );
  }

  private async setupRenderer(): Promise<void> {
    const noiseTexture = await renderNoise([64, 1], 40, 1 / 10);

    this.renderer = await compile(
      this.canvas,
      [
        {
          ...InvertedTunnel.descriptor,
          shaderCombinationSteps: [0, 2, 6, 16, 32],
        },
        {
          ...Polygon.descriptor,
          shaderCombinationSteps: [0, 1],
        },
        {
          ...BlobShape.descriptor,
          shaderCombinationSteps: [0, 1, 2, 8],
        },
        {
          ...Circle.descriptor,
          shaderCombinationSteps: [0, 2, 16, 32],
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
        shadowTraceCount: 16,
        paletteSize: 10,
        enableStopwatch: true,
        ignoreWebGL2: true,
      },
    );

    this.renderer.setRuntimeSettings({
      //isWorldInverted: true,
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
    this.renderer.addDrawable(
      new Polygon([
        [10.0, 10.0],
        [200, 500],
        [500, 400],
      ]),
    );
    this.renderer.renderDrawables();
  }

  public async start(): Promise<void> {
    await Promise.all([/*this.setupCommunication(),*/ this.setupRenderer()]);
    // requestAnimationFrame(this.gameLoop.bind(this));
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    return this.renderer.displayToWorldCoordinates(p);
  }

  public aspectRatioChanged(aspectRatio: number) {
    this.socket.emit(
      TransportEvents.PlayerToServer,
      serialize(new SetAspectRatioActionCommand(aspectRatio)),
    );
  }

  private gameLoop(time: DOMHighResTimeStamp) {
    const deltaTime = this.deltaTimeCalculator.getNextDeltaTimeInMilliseconds(time);

    this.gameObjects.sendCommand(new StepCommand(deltaTime));
    this.gameObjects.sendCommand(new RenderCommand(this.renderer));
    this.renderer.renderDrawables();

    this.overlay.innerText = prettyPrint(this.renderer.insights);
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
