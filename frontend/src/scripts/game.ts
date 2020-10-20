import { vec2 } from 'gl-matrix';
import {
  CircleLight,
  ColorfulCircle,
  compile,
  FilteringOptions,
  Flashlight,
  Renderer,
  renderNoise,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import {
  broadcastCommands,
  deserialize,
  serialize,
  settings,
  TransportEvents,
  SetAspectRatioActionCommand,
  rgb,
  PlayerInformation,
  PlayerDiedCommand,
  UpdatePlanetOwnershipCommand,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/generators/keyboard-listener';
import { MouseListener } from './commands/generators/mouse-listener';
import { TouchListener } from './commands/generators/touch-listener';
import { CommandReceiverSocket } from './commands/receivers/command-receiver-socket';
import { PlayerDecision } from './join-form-handler';
import { GameObjectContainer } from './objects/game-object-container';
import { BlobShape } from './shapes/blob-shape';
import { PlanetShape } from './shapes/planet-shape';

export class Game {
  public readonly gameObjects = new GameObjectContainer(this);
  private renderer?: Renderer;
  private socket!: SocketIOClient.Socket;
  private deadTimeout = 0;

  private declaPlanetCountElement = document.createElement('div');
  private redPlanetCountElement = document.createElement('div');
  private neutralPlanetCountElement = document.createElement('div');

  constructor(
    private readonly playerDecision: PlayerDecision,
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLElement,
  ) {
    this.start();
    const progressBar = document.createElement('div');
    progressBar.className = 'planet-progress';
    overlay.appendChild(progressBar);
    progressBar.appendChild(this.declaPlanetCountElement);
    progressBar.appendChild(this.neutralPlanetCountElement);
    progressBar.appendChild(this.redPlanetCountElement);
  }

  private async setupCommunication(serverUrl: string): Promise<void> {
    this.socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
    });

    this.socket.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serialized: string) => {
      const command = deserialize(serialized);
      if (command instanceof PlayerDiedCommand) {
        this.deadTimeout = command.timeout;
        this.overlay.appendChild(this.announcmentText);
      } else if (command instanceof UpdatePlanetOwnershipCommand) {
        const all = command.declaCount + command.redCount + command.neutralCount;
        this.declaPlanetCountElement.style.width = (command.declaCount / all) * 100 + '%';
        this.neutralPlanetCountElement.style.width =
          (command.neutralCount / all) * 100 + '%';
        this.redPlanetCountElement.style.width = (command.redCount / all) * 100 + '%';

        if (command.declaCount > all * 0.5) {
          this.overlay.appendChild(this.announcmentText);
          this.announcmentText.innerText = 'Decla team won 🎉';
        }

        if (command.redCount > all * 0.5) {
          this.overlay.appendChild(this.announcmentText);
          this.announcmentText.innerText = 'Red team won 🎉';
        }
      } else this.gameObjects.sendCommand(command);
    });

    this.socket.on(TransportEvents.Ping, () => {
      this.socket.emit(TransportEvents.Pong);
    });

    this.socket.emit(TransportEvents.PlayerJoining, {
      name: this.playerDecision.playerName,
    } as PlayerInformation);

    broadcastCommands(
      [
        new KeyboardListener(document.body),
        new MouseListener(this.canvas, this),
        new TouchListener(this.canvas, this),
      ],
      [this.gameObjects, new CommandReceiverSocket(this.socket)],
    );
  }

  private async start(): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 2, 1);
    this.setupCommunication(this.playerDecision.server);
    runAnimation(
      this.canvas,
      [
        {
          ...PlanetShape.descriptor,
          shaderCombinationSteps: [0, 1, 2, 3],
        },
        {
          ...BlobShape.descriptor,
          shaderCombinationSteps: [0, 1, 2, 8],
        },
        {
          ...ColorfulCircle.descriptor,
          shaderCombinationSteps: [0, 2, 16],
        },
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 1, 2, 4, 8, 16],
        },
        {
          ...Flashlight.descriptor,
          shaderCombinationSteps: [0],
        },
      ],
      this.gameLoop.bind(this),
      {
        shadowTraceCount: 16,
        paletteSize: settings.palette.length,
        //enableStopwatch: true,
      },
      {
        ambientLight: rgb(0.45, 0.4, 0.45),
        colorPalette: settings.palette,
        enableHighDpiRendering: true,
        lightCutoffDistance: settings.lightCutoffDistance,
        textures: {
          noiseTexture: {
            source: noiseTexture,
            overrides: {
              maxFilter: FilteringOptions.LINEAR,
              wrapS: WrapOptions.MIRRORED_REPEAT,
              wrapT: WrapOptions.MIRRORED_REPEAT,
            },
          },
        },
      },
    );
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    const result = this.renderer?.displayToWorldCoordinates(p);
    if (!result) {
      return vec2.create();
    }
    return result;
  }

  public aspectRatioChanged(aspectRatio: number) {
    this.socket.emit(
      TransportEvents.PlayerToServer,
      serialize(new SetAspectRatioActionCommand(aspectRatio)),
    );
  }

  private announcmentText = document.createElement('h2');
  private gameLoop(
    renderer: Renderer,
    currentTime: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.renderer = renderer;

    if ((this.deadTimeout -= deltaTime / 1000) > 0) {
      this.announcmentText.innerText = `Respawning in ${Math.floor(this.deadTimeout)} …`;
    } else {
      this.announcmentText.parentElement?.removeChild(this.announcmentText);
    }

    this.gameObjects.stepObjects(deltaTime);
    this.gameObjects.drawObjects(this.renderer, this.overlay);

    return true;
  }
}
