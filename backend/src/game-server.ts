import { PhysicalContainer } from './physics/containers/physical-container';
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
import { PlayerContainer } from './players/player-container';

const playerCountSubscribedRoom = 'playerCountUpdates';

export class GameServer {
  private objects = new PhysicalContainer();
  private players: PlayerContainer;
  private deltaTimes: Array<number> = [];
  private deltaTimeCalculator = new DeltaTimeCalculator();

  private serverName: string;
  private playerLimit: number;

  constructor(private readonly io: ioserver.Server, options: Options) {
    this.players = new PlayerContainer(this.objects);

    this.serverName = options.name;
    this.playerLimit = options.playerLimit;

    createWorld(this.objects, options.worldSize);
    this.objects.initialize();

    io.on('connection', (socket: SocketIO.Socket) => {
      socket.on(TransportEvents.PlayerJoining, (playerInfo: PlayerInformation) => {
        const player = this.players.createPlayer(playerInfo, socket);
        socket.on(TransportEvents.PlayerToServer, (json: string) => {
          const command = deserialize(json);
          player.sendCommand(command);
        });

        this.sendPlayerCountUpdate();

        socket.on('disconnect', () => {
          player.destroy();
          this.players.deletePlayer(player);
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
      .emit(TransportEvents.PlayerCountUpdate, this.players.count);
  }

  public start() {
    this.handlePhysics();
  }

  private handlePhysics() {
    const delta = this.deltaTimeCalculator.getNextDeltaTimeInSeconds();
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
    }

    this.objects.stepObjects(delta);
    this.players.step(delta);

    const physicsDelta = this.deltaTimeCalculator.getDeltaTimeInSeconds() * 1000;
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
      playerCount: this.players.count,
      playerLimit: this.playerLimit,
    };
  }
}
