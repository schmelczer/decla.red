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
  InputAcknowledgement,
} from 'shared';
import { io, Socket } from 'socket.io-client';
import { KeyboardListener } from './commands/keyboard-listener';
import { MouseListener } from './commands/mouse-listener';
import { TouchListener } from './commands/touch-listener';
import { CommandSocket } from './commands/command-socket';
import { PlayerDecision } from './join-form-handler';
import { GameObjectContainer } from './objects/game-object-container';
import parser from 'socket.io-msgpack-parser';
import { CharacterShape } from './shapes/character-shape';
import { PlanetShape } from './shapes/planet-shape';
import { RenderCommand } from './commands/types/render';
import { StepCommand } from './commands/types/step';
import { serverTimeline } from './helper/server-timeline';
import { localCharacterPredictor } from './helper/prediction/local-character-predictor';
import { Tutorial } from './tutorial';
import { Scoreboard } from './scoreboard';

export class Game extends CommandReceiver {
  public gameObjects = new GameObjectContainer(this);
  public renderer?: Renderer;
  private socket!: Socket;
  private isBetweenGames = false;

  public started: Promise<void>;
  private resolveStarted!: () => unknown;

  private keyboardListener: KeyboardListener;
  private mouseListener: MouseListener;
  private touchListener: TouchListener;

  private scoreboard = new Scoreboard();
  private announcementText = document.createElement('h2');
  private arrows: { [id: number]: HTMLElement } = {};
  private keystoneArrow?: HTMLElement;
  private socketReceiver!: CommandSocket;
  private tutorial!: Tutorial;

  constructor(
    private readonly playerDecision: PlayerDecision,
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLElement,
  ) {
    super();
    this.started = new Promise((r) => (this.resolveStarted = r));
    this.announcementText.className = 'announcement';

    this.keyboardListener = new KeyboardListener();
    this.mouseListener = new MouseListener(this.canvas, this);
    this.touchListener = new TouchListener(this.canvas, this.overlay, this);
  }

  private initialize() {
    this.isBetweenGames = true;

    this.socket?.close();
    serverTimeline.reset();
    localCharacterPredictor.reset();
    this.gameObjects = new GameObjectContainer(this);
    this.overlay.innerHTML = '';
    this.arrows = {};
    this.keystoneArrow = undefined;
    this.isEnding = false;
    this.lastAnnouncementText = '';
    this.overlay.appendChild(this.scoreboard.element);
    this.announcementText.innerText = '';
    this.timeScaling = 1;
    this.overlay.appendChild(this.announcementText);
    this.tutorial = new Tutorial(this.overlay);

    this.socket = io(this.playerDecision.server, {
      reconnectionDelayMax: 10000,
      transports: ['websocket'],
      forceNew: true,
      parser,
    } as any);

    // In socket.io-client v4 reconnection events are emitted by the Manager
    // (`socket.io`), not the Socket itself.
    this.socket.io.on('reconnect_attempt', () => {
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
      commands.forEach((c) => this.handleCommand(c));
    });

    this.socketReceiver = new CommandSocket(this.socket);
    // The tutorial listens to the same input streams as the socket, so its
    // stages clear off the player's own commands without any server involvement.
    this.keyboardListener.clearSubscribers();
    this.keyboardListener.subscribe(this.socketReceiver);
    this.keyboardListener.subscribe(this.tutorial);
    this.mouseListener.clearSubscribers();
    this.mouseListener.subscribe(this.socketReceiver);
    this.mouseListener.subscribe(this.tutorial);
    this.touchListener.clearSubscribers();
    this.touchListener.subscribe(this.socketReceiver);
    this.touchListener.subscribe(this.tutorial);

    this.isBetweenGames = false;

    this.socket.emit(TransportEvents.PlayerJoining, this.playerDecision);
  }

  protected defaultCommandExecutor(c: Command) {
    this.gameObjects.handleCommand(c);
  }

  private lastGameState?: UpdateGameState;
  private isEnding = false;
  private timeScaling = 1;

  private lastAnnouncementText = '';
  protected commandExecutors: CommandExecutors = {
    [ServerAnnouncement.type]: (c: ServerAnnouncement) => {
      this.lastAnnouncementText = c.text;
      this.timeSinceLastAnnouncement = 0;
    },
    [UpdateGameState.type]: (c: UpdateGameState) => (this.lastGameState = c),
    [InputAcknowledgement.type]: (c: InputAcknowledgement) =>
      localCharacterPredictor.acknowledge(
        c.clientTimeMs,
        c.bodyVelocity,
        c.lastLeapClientTimeMs,
      ),
    [GameEndCommand.type]: () => (this.isEnding = true),
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
      e.style.transform = `translateX(${p.x}px) translateY(${p.y
        }px) translateX(-50%) translateY(-50%) rotate(${-angle + Math.PI / 2}rad) `;
    });

    for (const id in this.arrows) {
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
        CharacterShape.descriptor,
        {
          ...CircleLight.descriptor,
          shaderCombinationSteps: [0, 1, 2, 4, 8, 16],
        },
      ],
      this.gameLoop.bind(this),
      {
        shadowTraceCount: 16,
        paletteSize: settings.paletteDim.length,
        colorPalette: settings.paletteDim,
        enableHighDpiRendering: true,
        lightCutoffDistance: settings.lightCutoffDistance,
        lightOverlapReduction: settings.lightOverlapReduction,
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
    this.socketReceiver.handleCommand(new SetAspectRatioActionCommand(aspectRatio));
  }

  private isActive = true;
  public destroy() {
    this.isActive = false;
  }

  private timeSinceLastAnnouncement = 0;
  private framesSinceLastLayoutUpdate = 0;
  private gameLoop(
    renderer: Renderer,
    _: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.resolveStarted();
    deltaTime /= 1000;

    // Stepped before the end-game time scaling on purpose: the slow motion is
    // already baked into the snapshots the server sends, so the playback
    // cursor itself must keep running on wall-clock time.
    serverTimeline.step(deltaTime);

    let shouldChangeLayout = false;
    if (++this.framesSinceLastLayoutUpdate > 1) {
      shouldChangeLayout = true;
      this.framesSinceLastLayoutUpdate = 0;
      this.draw();
    }

    if (
      (this.timeSinceLastAnnouncement += deltaTime) > settings.announcementVisibleSeconds
    ) {
      this.lastAnnouncementText = '';
    }

    if (this.isEnding) {
      this.timeScaling *= Math.pow(settings.endGameDeltaScaling, deltaTime);
      deltaTime /= this.timeScaling;
    }

    this.renderer = renderer;

    this.gameObjects.handleCommand(new StepCommand(deltaTime));
    this.gameObjects.handleCommand(
      new RenderCommand(this.renderer, this.overlay, shouldChangeLayout),
    );

    this.touchListener.update(deltaTime);

    this.tutorial.step(this.gameObjects);

    this.socketReceiver.sendQueuedCommands();

    return this.isActive;
  }

  private draw() {
    if (this.lastGameState) {
      // The local player's team is read off the main character once it exists.
      this.scoreboard.update(this.lastGameState, this.gameObjects.player?.team);
    }

    if (this.lastOtherPlayerDirections) {
      this.handleOtherPlayerDirections(this.lastOtherPlayerDirections);
    }

    this.handleKeystoneArrow();

    this.announcementText.innerHTML = this.lastAnnouncementText;
  }

  // Points an off-screen chevron toward the keystone "Heart" planet, tinted by
  // who currently holds it, so the match's focal objective is always findable.
  private handleKeystoneArrow() {
    if (!this.renderer) {
      return;
    }
    const keystone = this.gameObjects.planets.find((p) => p.isKeystone);
    if (!keystone) {
      if (this.keystoneArrow) {
        this.keystoneArrow.style.display = 'none';
      }
      return;
    }

    if (!this.keystoneArrow) {
      this.keystoneArrow = document.createElement('div');
      this.overlay.appendChild(this.keystoneArrow);
    }

    const width = this.renderer.canvasSize.x;
    const height = this.renderer.canvasSize.y;
    const display = this.renderer.worldToDisplayCoordinates(keystone.center);
    const margin = 48;
    const onScreen =
      display.x >= margin &&
      display.x <= width - margin &&
      display.y >= margin &&
      display.y <= height - margin;

    const control = Math.abs(keystone.ownership - 0.5);
    const team =
      control < settings.planetControlThreshold
        ? 'neutral'
        : keystone.ownership < 0.5
          ? 'blue'
          : 'red';
    this.keystoneArrow.className = 'keystone-arrow ' + team;

    if (onScreen) {
      this.keystoneArrow.style.display = 'none';
      return;
    }
    this.keystoneArrow.style.display = 'block';

    const center = vec2.fromValues(width / 2, height / 2);
    const dir = vec2.fromValues(display.x - center.x, display.y - center.y);
    const angle = Math.atan2(dir.y, dir.x);

    const aspectRatio = width / height;
    const directionRatio = dir.x / dir.y;
    let deltaX: number, deltaY: number;
    if (aspectRatio < Math.abs(directionRatio)) {
      deltaX = (width / 2 - margin) * Math.sign(dir.x);
      deltaY = deltaX / directionRatio;
    } else {
      deltaY = (height / 2 - margin) * Math.sign(dir.y);
      deltaX = deltaY * directionRatio;
    }

    const p = vec2.add(center, center, vec2.fromValues(deltaX, deltaY));
    this.keystoneArrow.style.transform = `translateX(${p.x}px) translateY(${p.y}px) translateX(-50%) translateY(-50%) rotate(${angle + Math.PI / 2}rad)`;
  }
}
