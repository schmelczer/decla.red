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
import { RenderCommand } from './commands/types/render';
import { StepCommand } from './commands/types/step';
import { serverTimeline } from './helper/server-timeline';
import {
  localCharacterPredictor,
  setFrameTimeMs,
} from './helper/prediction/local-character-predictor';
import { Tutorial } from './tutorial';
import { Scoreboard } from './scoreboard';
import { Minimap } from './minimap';
import { ScreenShake } from './screen-shake';
import { FeedbackHud } from './feedback-hud';

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
  private minimap = new Minimap();
  private announcementText = document.createElement('h2');
  private keystoneArrow?: HTMLElement;
  private socketReceiver!: CommandSocket;
  private tutorial!: Tutorial;
  // Issued by the server on join; presented on reconnect to reclaim this
  // player's team and score instead of coming back as a blank slate.
  private reconnectToken?: string;
  private connectionBanner?: HTMLElement;
  private rejectionReason?: JoinRejectionReason;

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
    // Clear any leftover shake/zoom so a kill at the end of one match can't bleed
    // its camera impact into the next.
    ScreenShake.reset();
    this.gameObjects = new GameObjectContainer(this);
    this.overlay.innerHTML = '';
    this.keystoneArrow = undefined;
    this.lastMinimap = undefined;
    this.isEnding = false;
    this.lastAnnouncementText = '';
    this.overlay.appendChild(this.scoreboard.element);
    this.overlay.appendChild(this.minimap.element);
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

    // A transport drop is not the end of the match. Previously this tore the
    // game down on the first `disconnect`, which stopped the render loop, which
    // closed the socket — cancelling the reconnection the client is configured
    // for before it could ever run, and dumping the player on the server list.
    this.socket.on('disconnect', () => {
      if (this.isBetweenGames) {
        return;
      }
      this.showConnectionBanner('Reconnecting…');
    });

    this.socket.on('connect', () => {
      if (this.isBetweenGames) {
        return;
      }
      // A reconnect is a brand-new server-side connection that has never seen a
      // join, so the join has to be re-sent or the client sits connected and
      // invisible forever.
      this.hideConnectionBanner();
      serverTimeline.reset();
      localCharacterPredictor.reset();
      // ...and it is a brand-new server-side *player*, whose view-area
      // bookkeeping starts empty. Anything the dropped session was told about
      // will never be retracted, so the old world has to go here.
      this.gameObjects.reset();
      this.socket.emit(TransportEvents.PlayerJoining, {
        ...this.playerDecision,
        reconnectToken: this.reconnectToken,
      });
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

    // Echo the nonce: the server only accepts a reply that matches the ping
    // still outstanding, so a stale or duplicated Pong cannot move its RTT.
    this.socket.on(TransportEvents.Ping, (nonce: unknown) => {
      this.socket.emit(TransportEvents.Pong, nonce);
    });

    this.socket.on(TransportEvents.ServerToPlayer, (serializedCommands: string) => {
      // One malformed object must not take down the message pump. deserialize
      // revives classes by name from the payload, so a hostile or corrupt field
      // can throw inside JSON.parse's reviver — and every later batch would be
      // lost with it.
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

    // The join is emitted from the socket's `connect` handler above, which fires
    // for the first connection and for every reconnection alike — so one code
    // path covers both, and a reconnect can never be left unjoined.
    this.isBetweenGames = false;
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
        c.movement,
        c.lastLeapClientTimeMs,
        c.ackAgeMs,
      ),
    [GameEndCommand.type]: () => (this.isEnding = true),
    [UpdateMinimap.type]: (c: UpdateMinimap) => (this.lastMinimap = c),
    [GameStartCommand.type]: this.initialize.bind(this),
  };

  private lastMinimap?: UpdateMinimap;

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
    this.hideConnectionBanner();
    // The HUD root lives on document.body, not the overlay, so it has to be torn
    // down explicitly or it stays painted over the landing page.
    FeedbackHud.reset();
    this.keyboardListener.destroy();
    this.mouseListener.destroy();
    this.touchListener.destroy();
  }

  /** Why the player was sent back to the server list, if they were. */
  public get lastRejectionReason(): JoinRejectionReason | undefined {
    return this.rejectionReason;
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
    currentTime: DOMHighResTimeStamp,
    deltaTime: DOMHighResTimeStamp,
  ): boolean {
    this.resolveStarted();
    // The client's one clock, for input stamps, the outgoing send cadence and
    // the prediction replay window alike. It has to be the frame's timestamp
    // rather than performance.now(): the two differ by however long the browser
    // took to dispatch this callback, and that difference would land straight
    // in the replay window and jitter the predicted body.
    setFrameTimeMs(currentTime);
    deltaTime /= 1000;

    // Decay the camera impact effects on raw wall-clock time, before any of the
    // end-game slow-motion scaling below. These only adjust the rendered view,
    // never the simulation, so they stay decoupled from prediction and netcode.
    ScreenShake.step(deltaTime);

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

    this.touchListener.update();

    this.tutorial.step(this.gameObjects);

    this.socketReceiver.sendQueuedCommands();

    return this.isActive;
  }

  private draw() {
    if (this.lastGameState) {
      // The local player's team is read off the main character once it exists.
      this.scoreboard.update(this.lastGameState, this.gameObjects.player?.team);
    }

    this.minimap.update(
      this.gameObjects.localPlayerPosition,
      this.lastMinimap?.players ?? [],
    );

    this.handleKeystoneArrow();

    if (this.announcementText.innerHTML !== this.lastAnnouncementText) {
      this.announcementText.innerHTML = this.lastAnnouncementText;
    }
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

    this.keystoneArrow.className = 'keystone-arrow ' + keystone.team;

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
