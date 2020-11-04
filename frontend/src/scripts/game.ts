import { vec2 } from 'gl-matrix';
import {
  CircleLight,
  FilteringOptions,
  Renderer,
  renderNoise,
  runAnimation,
  WrapOptions,
} from 'sdf-2d';
import {
  deserialize,
  TransportEvents,
  SetAspectRatioActionCommand,
  PlayerInformation,
  UpdateOtherPlayerDirections,
  clamp,
  UpdateGameState,
  GameEndCommand,
  ServerAnnouncement,
  GameStartCommand,
  CommandReceiver,
  CommandExecutors,
  Command,
  settings,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/keyboard-listener';
import { MouseListener } from './commands/mouse-listener';
import { TouchListener } from './commands/touch-listener';
import { CommandSocket } from './commands/command-socket';
import { PlayerDecision } from './join-form-handler';
import { GameObjectContainer } from './objects/game-object-container';
import parser from 'socket.io-msgpack-parser';
import { BlobShape } from './shapes/blob-shape';
import { PlanetShape } from './shapes/planet-shape';

export class Game extends CommandReceiver {
  public gameObjects = new GameObjectContainer(this);
  public renderer?: Renderer;
  private socket!: SocketIOClient.Socket;
  private isBetweenGames = false;

  public started: Promise<void>;
  private resolveStarted!: () => unknown;

  private keyboardListener: KeyboardListener;
  private mouseListener: MouseListener;
  private touchListener: TouchListener;

  private declaPlanetCountElement = document.createElement('div');
  private redPlanetCountElement = document.createElement('div');
  private announcementText = document.createElement('h2');
  private progressBar = document.createElement('div');
  private arrows: { [id: number]: HTMLElement } = {};
  private socketReceiver!: CommandSocket;

  constructor(
    private readonly playerDecision: PlayerDecision,
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLElement,
  ) {
    super();
    this.started = new Promise((r) => (this.resolveStarted = r));
    this.announcementText.className = 'announcement';
    this.progressBar.className = 'planet-progress';
    this.progressBar.appendChild(this.declaPlanetCountElement);
    this.progressBar.appendChild(this.redPlanetCountElement);

    this.keyboardListener = new KeyboardListener();
    this.mouseListener = new MouseListener(this.canvas, this);
    this.touchListener = new TouchListener(this.canvas, this.overlay, this);
  }

  private initialize() {
    this.isBetweenGames = true;

    this.socket?.close();
    this.gameObjects = new GameObjectContainer(this);
    this.overlay.innerHTML = '';
    this.isEnding = false;
    this.lastAnnouncementText = '';
    this.overlay.appendChild(this.progressBar);
    this.announcementText.innerText = '';
    this.overlay.appendChild(this.announcementText);

    this.socket = io(this.playerDecision.server, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
      forceNew: true,
      parser,
    } as any);

    this.socket.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on('disconnect', () => {
      if (!this.isBetweenGames) {
        this.destroy();
      }
    });

    this.socket.on(TransportEvents.Ping, () => {
      this.socket.emit(TransportEvents.Pong);
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serializedCommands: string) => {
      const commands: Array<Command> = deserialize(serializedCommands);
      commands.forEach((c) => this.sendCommand(c));
    });

    this.socketReceiver = new CommandSocket(this.socket);
    this.keyboardListener.clearSubscribers();
    this.keyboardListener.subscribe(this.socketReceiver);
    this.mouseListener.clearSubscribers();
    this.mouseListener.subscribe(this.socketReceiver);
    this.touchListener.clearSubscribers();
    this.touchListener.subscribe(this.socketReceiver);

    this.isBetweenGames = false;

    this.socket.emit(TransportEvents.PlayerJoining, this.playerDecision);
  }

  protected defaultCommandExecutor(c: Command) {
    this.gameObjects.sendCommand(c);
  }

  private lastGameState?: UpdateGameState;
  private isEnding = false;
  private lastAnnouncementText = '';
  protected commandExecutors: CommandExecutors = {
    [ServerAnnouncement.type]: (c: ServerAnnouncement) =>
      (this.lastAnnouncementText = c.text),
    [UpdateGameState.type]: (c: UpdateGameState) => (this.lastGameState = c),
    [GameEndCommand.type]: (c: GameEndCommand) => {
      const team = `<span class="${c.winningTeam}">${c.winningTeam}</span>`;
      this.lastAnnouncementText = `Team ${team} won 🎉`;
      this.isEnding = true;
    },
    [UpdateOtherPlayerDirections.type]: (c: UpdateOtherPlayerDirections) =>
      (this.lastOtherPlayerDirections = c),
    [GameStartCommand.type]: this.initialize.bind(this),
  };

  private lastOtherPlayerDirections?: UpdateOtherPlayerDirections;
  private handleOtherPlayerDirections(command: UpdateOtherPlayerDirections) {
    command.otherPlayerDirections.forEach((d) => {
      if (!(d.id! in this.arrows)) {
        const element = document.createElement('div');
        this.arrows[d.id!] = element;
        this.overlay.appendChild(element);
      }

      const e = this.arrows[d.id!];
      const direction = d.direction;
      const team = d.team;
      const angle = Math.atan2(direction.y, direction.x);
      e.className = 'other-player-arrow ' + team;

      if (!this.renderer) {
        return;
      }

      const width = this.renderer.canvasSize.x;
      const height = this.renderer.canvasSize.y;
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

    for (let id in this.arrows) {
      if (
        Object.prototype.hasOwnProperty.call(this.arrows, id) &&
        command.otherPlayerDirections.find((v) => v.id?.toString() === id) === undefined
      ) {
        this.arrows[id].parentElement?.removeChild(this.arrows[id]);
        delete this.arrows[id];
      }
    }
  }

  public async start(): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 2, 1);

    this.initialize();

    await runAnimation(
      this.canvas,
      [
        PlanetShape.descriptor,
        BlobShape.descriptor,
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 1, 2, 4, 8, 16],
        },
      ],
      this.gameLoop.bind(this),
      {
        shadowTraceCount: 16,
        paletteSize: settings.palette.length,
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
    this.keyboardListener.destroy();
    this.mouseListener.destroy();
    this.touchListener.destroy();
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    return this.renderer?.displayToWorldCoordinates(p) ?? vec2.create();
  }

  public aspectRatioChanged(aspectRatio: number) {
    this.socketReceiver.sendCommand(new SetAspectRatioActionCommand(aspectRatio));
  }

  private isActive = true;
  public destroy() {
    this.isActive = false;
  }

  private framesSinceLastLayoutUpdate = 0;
  private gameLoop(
    renderer: Renderer,
    _: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.resolveStarted();
    deltaTime /= 1000;

    let shouldChangeLayout = false;
    if (++this.framesSinceLastLayoutUpdate > 1) {
      shouldChangeLayout = true;
      this.framesSinceLastLayoutUpdate = 0;
      this.draw();
    }

    this.renderer = renderer;

    this.socketReceiver.sendQueuedCommands();
    this.gameObjects.stepObjects(this.isEnding ? 0 : deltaTime);
    this.gameObjects.drawObjects(this.renderer, this.overlay, shouldChangeLayout);

    return this.isActive;
  }

  private draw() {
    if (this.lastGameState) {
      this.declaPlanetCountElement.style.width =
        (this.lastGameState.declaCount / this.lastGameState.limit) * 50 + '%';
      this.redPlanetCountElement.style.width =
        (this.lastGameState.redCount / this.lastGameState.limit) * 50 + '%';
    }

    if (this.lastOtherPlayerDirections) {
      this.handleOtherPlayerDirections(this.lastOtherPlayerDirections);
    }

    this.announcementText.innerHTML = this.lastAnnouncementText;
  }
}
