import { vec2 } from 'gl-matrix';
import {
  CircleLight,
  ColorfulCircle,
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
  PlayerInformation,
  PlayerDiedCommand,
  UpdateGameState,
  clamp,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/generators/keyboard-listener';
import { MouseListener } from './commands/generators/mouse-listener';
import { TouchJoystickListener } from './commands/generators/touch-joystick-listener';
import { CommandReceiverSocket } from './commands/receivers/command-receiver-socket';
import { PlayerDecision } from './join-form-handler';
import { GameObjectContainer } from './objects/game-object-container';
import { OptionsHandler } from './options-handler';
import { BlobShape } from './shapes/blob-shape';
import { PlanetShape } from './shapes/planet-shape';

export class Game {
  public readonly gameObjects = new GameObjectContainer(this);
  public renderer?: Renderer;
  private socket!: SocketIOClient.Socket;
  private deadTimeout = 0;

  private declaPlanetCountElement = document.createElement('div');
  private redPlanetCountElement = document.createElement('div');
  private neutralPlanetCountElement = document.createElement('div');
  private announcementText = document.createElement('h2');

  constructor(
    private readonly playerDecision: PlayerDecision,
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLElement,
  ) {
    this.announcementText.className = 'announcement';
    const progressBar = document.createElement('div');
    progressBar.className = 'planet-progress';
    overlay.appendChild(progressBar);
    progressBar.appendChild(this.declaPlanetCountElement);
    progressBar.appendChild(this.neutralPlanetCountElement);
    progressBar.appendChild(this.redPlanetCountElement);
  }

  private arrowElements: Array<HTMLElement> = [];
  private async setupCommunication(serverUrl: string): Promise<void> {
    this.socket = io(serverUrl, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
    });

    this.socket.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on('disconnect', this.destroy.bind(this));

    this.socket.on(TransportEvents.ServerToPlayer, (serialized: string) => {
      const command = deserialize(serialized);
      if (command instanceof PlayerDiedCommand) {
        this.deadTimeout = command.timeout;
        if (OptionsHandler.options.vibrationEnabled) {
          navigator.vibrate(150);
        }
        this.overlay.appendChild(this.announcementText);
      } else if (command instanceof UpdateGameState) {
        const all = command.declaCount + command.redCount + command.neutralCount;
        this.declaPlanetCountElement.style.width = (command.declaCount / all) * 100 + '%';
        this.neutralPlanetCountElement.style.width =
          (command.neutralCount / all) * 100 + '%';
        this.redPlanetCountElement.style.width = (command.redCount / all) * 100 + '%';

        if (command.declaCount > all * 0.5) {
          this.overlay.appendChild(this.announcementText);
          this.announcementText.innerText = 'Decla team won 🎉';
        }

        if (command.redCount > all * 0.5) {
          this.overlay.appendChild(this.announcementText);
          this.announcementText.innerText = 'Red team won 🎉';
        }

        this.arrowElements
          .splice(command.otherPlayerDirections.length, this.arrowElements.length)
          .forEach((e) => e.parentElement?.removeChild(e));

        for (
          let i = this.arrowElements.length;
          i < command.otherPlayerDirections.length;
          i++
        ) {
          const element = document.createElement('div');
          this.arrowElements.push(element);
          this.overlay.appendChild(element);
        }

        this.arrowElements.forEach((e, i) => {
          const direction = command.otherPlayerDirections[i].direction;
          const team = command.otherPlayerDirections[i].team;
          const angle = Math.atan2(direction.y, direction.x);
          e.className = 'other-player-arrow ' + team;

          const { width, height } = this.overlay.getBoundingClientRect();
          const aspectRatio = width / height;
          const directionRatio = direction.x / direction.y;

          let deltaX: number, deltaY: number;
          if (aspectRatio < Math.abs(directionRatio)) {
            deltaX = (width / 2) * Math.sign(direction.x);
            deltaY = deltaX / directionRatio;
          } else {
            deltaY = (height / 2) * Math.sign(direction.y);
            deltaX = deltaY * directionRatio;
          }

          const delta = vec2.fromValues(deltaX, deltaY);
          const center = vec2.fromValues(width / 2, height / 2);
          const p = vec2.add(center, center, delta);
          const arrowPadding = 24;
          vec2.set(
            p,
            clamp(p.x, arrowPadding, width - arrowPadding),
            clamp(height - p.y, arrowPadding, height - arrowPadding),
          );
          e.style.transform = `translateX(${p.x}px) translateY(${
            p.y
          }px) translateX(-50%) translateY(-50%) rotate(${-angle + Math.PI / 2}rad) `;
        });
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
        new TouchJoystickListener(this.canvas, this.overlay, this),
      ],
      [this.gameObjects, new CommandReceiverSocket(this.socket)],
    );
  }

  public async start(): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 2, 1);
    this.setupCommunication(this.playerDecision.server);
    await runAnimation(
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
    this.socket.close();
    this.overlay.innerHTML = '';
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

  private isActive = true;
  public destroy() {
    this.isActive = false;
  }

  private gameLoop(
    renderer: Renderer,
    currentTime: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.renderer = renderer;

    if ((this.deadTimeout -= deltaTime / 1000) > 0) {
      this.announcementText.innerText = `Reviving in ${Math.floor(this.deadTimeout)}…`;
    } else {
      this.announcementText.parentElement?.removeChild(this.announcementText);
    }

    this.gameObjects.stepObjects(deltaTime);
    this.gameObjects.drawObjects(this.renderer, this.overlay);

    return this.isActive;
  }
}
