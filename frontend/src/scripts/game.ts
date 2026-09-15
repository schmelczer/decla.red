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
  UpdateMinimap,
  UpdateGameState,
  GameEndCommand,
  ServerAnnouncement,
  GameStartCommand,
  CommandReceiver,
  CommandExecutors,
  Command,
  settings,
  InputAcknowledgement,
  JoinRejectionReason,
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
import { serverTimeline } from './helper/server-timeline';
import { centeredTransform } from './helper/centered-transform';
import {
  localCharacterPredictor,
  setFrameTimeMs,
} from './helper/prediction/local-character-predictor';
import { Tutorial } from './tutorial';
import { Scoreboard } from './scoreboard';
import { Minimap } from './minimap';
import { ScreenShake } from './screen-shake';
import { FeedbackHud } from './feedback-hud';

const maximumReconnectionAttempts = 10;

export class Game extends CommandReceiver {
  public gameObjects = new GameObjectContainer(this);
  public renderer?: Renderer;
  public rejectionReason?: JoinRejectionReason;
  public readonly started: Promise<void>;

  private socket!: Socket;
  private socketReceiver!: CommandSocket;
  private tutorial!: Tutorial;
  private resolveStarted!: () => void;
  private isBetweenGames = false;
  private isActive = true;

  private readonly keyboardListener: KeyboardListener;
  private readonly mouseListener: MouseListener;
  private readonly touchListener: TouchListener;

  private readonly scoreboard = new Scoreboard();
  private readonly minimap = new Minimap();
  private readonly announcementText = document.createElement('h2');
  private keystoneArrow?: HTMLElement;
  private connectionBanner?: HTMLElement;
  private reconnectToken?: string;
  private lastAspectRatio?: number;
  private lastGameState?: UpdateGameState;
  private lastMinimap?: UpdateMinimap;
  private lastAnnouncementText = '';
  private timeSinceLastAnnouncement = 0;
  private framesSinceLastLayoutUpdate = 0;

  protected commandExecutors: CommandExecutors = {
    [ServerAnnouncement.name]: (c: ServerAnnouncement) => {
      this.lastAnnouncementText = c.text;
      this.timeSinceLastAnnouncement = 0;
    },
    [UpdateGameState.name]: (c: UpdateGameState) => (this.lastGameState = c),
    [InputAcknowledgement.name]: (c: InputAcknowledgement) =>
      localCharacterPredictor.acknowledge(
        c.clientTimeMs,
        c.movement,
        c.lastLeapClientTimeMs,
        c.ackAgeMs,
      ),
    [GameEndCommand.name]: () => (localCharacterPredictor.enabled = false),
    [UpdateMinimap.name]: (c: UpdateMinimap) => (this.lastMinimap = c),
    [GameStartCommand.name]: () => this.initialize(),
  };

  constructor(
    private readonly playerDecision: PlayerDecision,
    private readonly canvas: HTMLCanvasElement,
    private readonly overlay: HTMLElement,
  ) {
    super();
    this.started = new Promise((r) => (this.resolveStarted = r));
    this.announcementText.className = 'announcement';

    const onInput = (c: Command) => {
      this.socketReceiver.queue(c);
      this.tutorial.handleCommand(c);
    };
    this.keyboardListener = new KeyboardListener(onInput);
    this.mouseListener = new MouseListener(this.canvas, this, onInput);
    this.touchListener = new TouchListener(this.canvas, this.overlay, this, onInput);
  }

  protected defaultCommandExecutor(c: Command) {
    this.gameObjects.handleCommand(c);
  }

  private initialize() {
    this.isBetweenGames = true;

    this.socket?.close();
    serverTimeline.reset();
    localCharacterPredictor.reset();
    localCharacterPredictor.enabled = true;
    ScreenShake.reset();
    this.gameObjects.reset();
    this.gameObjects = new GameObjectContainer(this);
    this.overlay.innerHTML = '';
    this.keystoneArrow = undefined;
    this.connectionBanner = undefined;
    this.lastMinimap = undefined;
    this.lastAnnouncementText = '';
    this.announcementText.innerText = '';
    this.overlay.append(
      this.scoreboard.element,
      this.minimap.element,
      this.announcementText,
    );
    this.tutorial = new Tutorial(this.overlay);

    this.socket = io(this.playerDecision.server, {
      reconnectionDelayMax: 10000,
      // Must be finite, otherwise `reconnect_failed` never fires.
      reconnectionAttempts: maximumReconnectionAttempts,
      transports: ['websocket'],
      forceNew: true,
      parser,
    } as any);
    this.socketReceiver = new CommandSocket(this.socket);

    this.socket.io.on('reconnect_attempt', () => {
      this.socket.io.opts.transports = ['polling', 'websocket'];
    });

    this.socket.on('disconnect', () => {
      if (!this.isBetweenGames) {
        this.showConnectionBanner('Reconnecting…');
      }
    });

    // Fires for every (re)connection: a reconnect is a brand-new server-side player.
    this.socket.on('connect', () => {
      if (this.isBetweenGames) {
        return;
      }
      this.hideConnectionBanner();
      serverTimeline.reset();
      localCharacterPredictor.reset();
      this.gameObjects.reset();
      this.socketReceiver.reset();
      this.socket.emit(TransportEvents.PlayerJoining, {
        ...this.playerDecision,
        reconnectToken: this.reconnectToken,
      });
      if (this.lastAspectRatio !== undefined) {
        this.socketReceiver.queue(new SetAspectRatioActionCommand(this.lastAspectRatio));
      }
    });

    this.socket.io.on('reconnect_failed', () => {
      this.showConnectionBanner('Connection lost');
      this.destroy();
    });

    this.socket.on(TransportEvents.PlayerJoined, (token: string) => {
      this.reconnectToken = typeof token === 'string' ? token : undefined;
      this.hideConnectionBanner();
    });

    this.socket.on(TransportEvents.JoinRejected, (reason: JoinRejectionReason) => {
      this.rejectionReason = reason;
      this.showConnectionBanner(Game.rejectionText(reason));
      this.destroy();
    });

    this.socket.on(TransportEvents.Ping, (nonce: unknown) => {
      this.socket.emit(TransportEvents.Pong, nonce);
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serializedCommands: string) => {
      try {
        const commands: Array<Command> = deserialize(serializedCommands);
        commands.forEach((c) => {
          try {
            this.handleCommand(c);
          } catch (e) {
            console.error('Failed to apply a server command', e);
          }
        });
      } catch (e) {
        console.error('Dropped an undecodable server message', e);
      }
    });

    this.isBetweenGames = false;
  }

  public async start(): Promise<void> {
    setFrameTimeMs(0);
    try {
      this.initialize();
      this.resolveStarted();
      let renderError: unknown;
      const noiseTexture = await renderNoise([256, 256], 2, 1);

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
        (renderer, currentTime, deltaTime) => {
          try {
            return this.gameLoop(renderer, currentTime, deltaTime);
          } catch (error) {
            renderError = error;
            return false;
          }
        },
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
      if (renderError) {
        throw renderError;
      }
    } finally {
      this.resolveStarted();
      this.socket?.close();
      this.gameObjects.reset();
      this.overlay.innerHTML = '';
      this.hideConnectionBanner();
      FeedbackHud.reset();
      this.keyboardListener.destroy();
      this.mouseListener.destroy();
      this.touchListener.destroy();
    }
  }

  public static rejectionText(reason: JoinRejectionReason): string {
    switch (reason) {
      case JoinRejectionReason.ServerFull:
        return 'That server is full — pick another';
      case JoinRejectionReason.RoundEnding:
        return 'That round is just finishing — try again in a moment';
      case JoinRejectionReason.AlreadyJoined:
        return 'Already joined on this connection';
      default:
        return 'The server refused the connection';
    }
  }

  private showConnectionBanner(text: string) {
    if (!this.connectionBanner) {
      this.connectionBanner = document.createElement('div');
      this.connectionBanner.className = 'connection-banner';
      this.overlay.appendChild(this.connectionBanner);
    }
    this.connectionBanner.innerText = text;
    this.connectionBanner.style.display = 'block';
  }

  private hideConnectionBanner() {
    if (this.connectionBanner) {
      this.connectionBanner.style.display = 'none';
    }
  }

  public displayToWorldCoordinates(p: vec2): vec2 {
    return this.renderer?.displayToWorldCoordinates(p) ?? vec2.create();
  }

  public aspectRatioChanged(aspectRatio: number) {
    this.lastAspectRatio = aspectRatio;
    this.socketReceiver.queue(new SetAspectRatioActionCommand(aspectRatio));
  }

  public destroy() {
    this.isActive = false;
  }

  public resendMovement() {
    this.keyboardListener.resendMovement();
    this.touchListener.resendMovement();
  }

  private gameLoop(
    renderer: Renderer,
    currentTime: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.renderer = renderer;
    // The frame timestamp, not performance.now(): dispatch jitter would land in the replay window.
    setFrameTimeMs(currentTime);
    deltaTime /= 1000;

    // Both run on wall-clock time: the end-game slow motion is already baked into the snapshots.
    ScreenShake.step(deltaTime);
    serverTimeline.step(deltaTime);

    const shouldChangeLayout = ++this.framesSinceLastLayoutUpdate > 1;
    if (shouldChangeLayout) {
      this.framesSinceLastLayoutUpdate = 0;
      this.draw();
    }

    if (
      (this.timeSinceLastAnnouncement += deltaTime) > settings.announcementVisibleSeconds
    ) {
      this.lastAnnouncementText = '';
    }

    this.gameObjects.step(deltaTime);
    this.gameObjects.render(renderer, this.overlay, shouldChangeLayout);
    this.touchListener.update();
    this.tutorial.step(this.gameObjects);
    this.socketReceiver.sendQueuedCommands();

    return this.isActive;
  }

  private draw() {
    // Before any style writes this frame, so the read cannot force a synchronous layout.
    this.minimap.measure();

    if (this.lastGameState) {
      this.scoreboard.update(this.lastGameState, this.gameObjects.localPlayer?.team);
    }

    this.minimap.update(
      this.gameObjects.localPlayer?.position,
      this.lastMinimap?.players ?? [],
    );

    this.handleKeystoneArrow();

    if (this.announcementText.innerHTML !== this.lastAnnouncementText) {
      this.announcementText.innerHTML = this.lastAnnouncementText;
    }
  }

  private handleKeystoneArrow() {
    const keystone = this.gameObjects.planets.find((p) => p.isKeystone);
    if (!this.renderer || !keystone) {
      if (this.keystoneArrow) {
        this.keystoneArrow.style.display = 'none';
      }
      return;
    }

    if (!this.keystoneArrow) {
      this.keystoneArrow = document.createElement('div');
      this.overlay.appendChild(this.keystoneArrow);
    }

    const [width, height] = this.renderer.canvasSize;
    const display = this.renderer.worldToDisplayCoordinates(keystone.center);
    const margin = 48;
    const onScreen =
      display[0] >= margin &&
      display[0] <= width - margin &&
      display[1] >= margin &&
      display[1] <= height - margin;

    this.keystoneArrow.className = 'keystone-arrow ' + keystone.team;
    this.keystoneArrow.style.display = onScreen ? 'none' : 'block';
    if (onScreen) {
      return;
    }

    const dx = display[0] - width / 2;
    const dy = display[1] - height / 2;
    const angle = Math.atan2(dy, dx);

    let deltaX: number, deltaY: number;
    if (width / height < Math.abs(dx / dy)) {
      deltaX = (width / 2 - margin) * Math.sign(dx);
      deltaY = (deltaX * dy) / dx;
    } else {
      deltaY = (height / 2 - margin) * Math.sign(dy);
      deltaX = (deltaY * dx) / dy;
    }

    this.keystoneArrow.style.transform = centeredTransform(
      width / 2 + deltaX,
      height / 2 + deltaY,
      ` rotate(${angle + Math.PI / 2}rad)`,
    );
  }
}
