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
import {
  broadcastCommands,
  deserialize,
  prettyPrint,
  serialize,
  settings,
  SetViewAreaActionCommand,
  StepCommand,
  TransportEvents,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/generators/keyboard-listener';
import { MouseListener } from './commands/generators/mouse-listener';
import { TouchListener } from './commands/generators/touch-listener';
import { CommandReceiverSocket } from './commands/receivers/command-receiver-socket';
import { RenderCommand } from './commands/types/render';
import { Configuration } from './config/configuration';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { rgb } from './helper/rgb';

import { GameObjectContainer } from './objects/game-object-container';
import { BlobShape } from './shapes/blob-shape';

export class Game {
  public readonly gameObjects = new GameObjectContainer();
  private readonly canvas: HTMLCanvasElement = document.querySelector('canvas#main');
  private renderer: Renderer;
  private socket: SocketIOClient.Socket;
  private deltaTimeCalculator = new DeltaTimeCalculator();
  private overlay: HTMLElement = document.querySelector('#overlay');
  private keyboardListener: KeyboardListener;

  private async setupCommunication(): Promise<void> {
    await Configuration.initialize();

    this.socket = io(Configuration.servers[0], {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
    });

    this.socket.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serialized: string) => {
      const command = deserialize(serialized);
      //console.log(command);
      this.gameObjects.sendCommand(command);
    });

    this.socket.emit(TransportEvents.PlayerJoining, null);

    this.keyboardListener = new KeyboardListener(document.body, 100);

    broadcastCommands(
      [
        this.keyboardListener,
        new MouseListener(this.canvas),
        new TouchListener(this.canvas),
      ],
      [this.gameObjects, new CommandReceiverSocket(this.socket)],
    );
  }

  private async setupRenderer(): Promise<void> {
    const noiseTexture = await renderNoise([512, 1], 50, 1 / 10);

    this.renderer = await compile(
      this.canvas,
      [
        {
          ...InvertedTunnel.descriptor,
          shaderCombinationSteps: [0, 2, 4, 8, 16],
        },
        {
          ...BlobShape.descriptor,
          shaderCombinationSteps: [0, 1, 2, 3, 4, 5, 8],
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
        shadowTraceCount: 16,
        paletteSize: 10,
        enableStopwatch: true,
      },
    );

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
  }

  public async start(): Promise<void> {
    await Promise.all([this.setupCommunication(), this.setupRenderer()]);
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    return this.renderer.displayToWorldCoordinates(p);
  }

  private gameLoop(time: DOMHighResTimeStamp) {
    const deltaTime = this.deltaTimeCalculator.getNextDeltaTimeInMilliseconds(time);
    this.keyboardListener.generateCommands();

    if (this.gameObjects.camera) {
      // todo: Should only send aspect ratio
      this.socket.emit(
        TransportEvents.PlayerToServer,
        serialize(new SetViewAreaActionCommand(this.gameObjects.camera.viewArea)),
      );
    }

    this.gameObjects.sendCommand(new StepCommand(deltaTime));
    /*this.camera.sendCommand(new MoveToCommand(this.character.position));
    this.camera.sendCommand(new RenderCommand(this.renderer));*/

    /*const shouldBeDrawn = this.physics
      .findIntersecting(this.camera.viewArea)
      .map((b) => b.owner);

    for (const object of shouldBeDrawn) {
      object?.sendCommand(new RenderCommand(this.renderer));
    }*/

    this.gameObjects.sendCommand(new RenderCommand(this.renderer) as any);

    this.renderer.renderDrawables();

    this.overlay.innerText = prettyPrint(this.renderer.insights);
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
