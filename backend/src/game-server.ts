import { PhysicalContainer } from './physics/containers/physical-container';
import { Player } from './players/player';
import ioserver from 'socket.io';
import {
  TransportEvents,
  deserialize,
  settings,
  ServerInformation,
  PlayerInformation,
} from 'shared';
import { createWorld } from './map/create-world';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { Options } from './options';

const playerCountSubscribedRoom = 'playerCountUpdates';

export class GameServer {
  private objects = new PhysicalContainer();
  private players: Array<Player> = [];
  private deltaTimes: Array<number> = [];
  private deltaTimeCalculator = new DeltaTimeCalculator();

  private serverName: string;
  private playerLimit: number;
  constructor(private readonly io: ioserver.Server, options: Options) {
    this.serverName = options.name;
    this.playerLimit = options.playerLimit;

    createWorld(this.objects);
    this.objects.initialize();

    io.on('connection', (socket: SocketIO.Socket) => {
      socket.on(TransportEvents.PlayerJoining, (playerInfo: PlayerInformation) => {
        const player = new Player(playerInfo, this.players, this.objects, socket);
        this.players.push(player);
        socket.on(TransportEvents.PlayerToServer, (json: string) => {
          const command = deserialize(json);
          player.sendCommand(command);
        });

        this.sendPlayerCountUpdate();

        socket.on('disconnect', () => {
          player.destroy();
          this.players = this.players.filter((p) => p !== player);
          this.sendPlayerCountUpdate();
        });
      });

      socket.on(TransportEvents.SubscribeForPlayerCount, () => {
        socket.join(playerCountSubscribedRoom);
      });
    });
  }

  public sendPlayerCountUpdate() {
    this.io
      .to(playerCountSubscribedRoom)
      .emit(TransportEvents.PlayerCountUpdate, this.players.length);
  }

  public start() {
    this.handlePhysics();
  }

  private handlePhysics() {
    const delta = this.deltaTimeCalculator.getNextDeltaTimeInMilliseconds();
    this.deltaTimes.push(delta);
    const framesBetweenDeltaTimeCalculation = 1000;

    if (this.deltaTimes.length > framesBetweenDeltaTimeCalculation) {
      this.deltaTimes.sort((a, b) => a - b);
      console.log(
        `Median physics time: ${this.deltaTimes[
          Math.floor(framesBetweenDeltaTimeCalculation / 2)
        ].toFixed(2)} ms`,
      );
      console.log(
        `Memory used: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      );
      this.deltaTimes = [];
      console.log(this.players.map((p) => p.latency));
    }

    this.objects.stepObjects(delta / 1000);
    this.players.forEach((p) => p.step(delta / 1000));

    const physicsDelta = this.deltaTimeCalculator.getDeltaTimeInMilliseconds();
    this.deltaTimes.push(physicsDelta);
    const sleepTime = settings.targetPhysicsDeltaTimeInMilliseconds - physicsDelta;
    if (sleepTime >= settings.minPhysicsSleepTime) {
      setTimeout(this.handlePhysics.bind(this), sleepTime);
    } else {
      setImmediate(this.handlePhysics.bind(this));
    }
  }

  public get serverInfo(): ServerInformation {
    return {
      serverName: this.serverName,
      playerCount: this.players.length,
      playerLimit: this.playerLimit,
    };
  }
}
