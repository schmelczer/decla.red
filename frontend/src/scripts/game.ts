import { vec2 } from 'gl-matrix';
import { Renderer, renderNoise } from 'sdf-2d';
import {
  broadcastCommands,
  deserialize,
  serialize,
  TransportEvents,
  SetAspectRatioActionCommand,
  PlayerInformation,
  PlayerDiedCommand,
  UpdateOtherPlayerDirections,
  clamp,
  UpdateGameState,
  GameEnd,
  CharacterTeam,
  ServerAnnouncement,
  GameStart,
  CommandReceiver,
  CommandExecutors,
  Command,
} from 'shared';
import io from 'socket.io-client';
import { KeyboardListener } from './commands/generators/keyboard-listener';
import { MouseListener } from './commands/generators/mouse-listener';
import { TouchJoystickListener } from './commands/generators/touch-joystick-listener';
import { CommandReceiverSocket } from './commands/receivers/command-receiver-socket';
import { startAnimation } from './start-animation';
import { PlayerDecision } from './join-form-handler';
import { GameObjectContainer } from './objects/game-object-container';
import { OptionsHandler } from './options-handler';
import parser from 'socket.io-msgpack-parser';
import { VibrationHandler } from './vibration-handler';

export class Game extends CommandReceiver {
  public gameObjects = new GameObjectContainer(this);
  public renderer?: Renderer;
  private socket!: SocketIOClient.Socket;
  private isBetweenGames = false;

  public started: Promise<void>;
  private resolveStarted!: () => unknown;

  private declaPlanetCountElement = document.createElement('div');
  private redPlanetCountElement = document.createElement('div');
  private announcementText = document.createElement('h2');
  private progressBar = document.createElement('div');
  private arrowElements: Array<HTMLElement> = [];
  private socketReceiver!: CommandReceiverSocket;

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
  }

  private initialize() {
    this.isBetweenGames = true;

    this.socket?.close();
    this.gameObjects = new GameObjectContainer(this);
    this.overlay.innerHTML = '';
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

    this.socketReceiver = new CommandReceiverSocket(this.socket);
    broadcastCommands(
      [
        new KeyboardListener(document.body),
        new MouseListener(this.canvas, this),
        new TouchJoystickListener(this.canvas, this.overlay, this),
      ],
      [this.socketReceiver],
    );

    this.isBetweenGames = false;

    this.socket.emit(TransportEvents.PlayerJoining, {
      name: this.playerDecision.playerName,
    } as PlayerInformation);
  }

  protected defaultCommandExecutor(c: Command) {
    this.gameObjects.sendCommand(c);
  }

  private lastGameState?: UpdateGameState;

  private lastAnnouncementText = '';
  protected commandExecutors: CommandExecutors = {
    [ServerAnnouncement.type]: (c: ServerAnnouncement) =>
      (this.lastAnnouncementText = c.text),
    [PlayerDiedCommand.type]: (c: PlayerDiedCommand) => VibrationHandler.vibrate(150),
    [UpdateGameState.type]: (c: UpdateGameState) => (this.lastGameState = c),
    [GameEnd.type]: (c: GameEnd) => {
      const team =
        c.winningTeam === CharacterTeam.decla
          ? '<span class="decla">decla</span>'
          : '<span class="red">red</span>';
      this.lastAnnouncementText = `Team ${team} won 🎉`;
    },
    [UpdateOtherPlayerDirections.type]: (c: UpdateOtherPlayerDirections) =>
      (this.lastOtherPlayerDirections = c),
    [GameStart.type]: this.initialize.bind(this),
  };

  private lastOtherPlayerDirections?: UpdateOtherPlayerDirections;
  private handleOtherPlayerDirections(command: UpdateOtherPlayerDirections) {
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
  }

  public async start(): Promise<void> {
    const noiseTexture = await renderNoise([256, 256], 2, 1);
    this.initialize();
    await startAnimation(this.canvas, this.gameLoop.bind(this), noiseTexture);
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
    this.gameObjects.stepObjects(deltaTime);
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
