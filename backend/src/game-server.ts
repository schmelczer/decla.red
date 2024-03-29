import { PhysicalContainer } from './physics/containers/physical-container';
import ioserver from 'socket.io';
import {
  TransportEvents,
  deserialize,
  settings,
  ServerInformation,
  PlayerInformation,
  UpdateGameState,
  CharacterTeam,
  GameEndCommand,
  GameStartCommand,
  Command,
  CommandReceiver,
  CommandExecutors,
} from 'shared';
import { createWorld } from './create-world';
import { DeltaTimeCalculator } from './helper/delta-time-calculator';
import { Options } from './options';
import { PlayerContainer } from './players/player-container';
import { StepCommand } from './commands/step';
import { GeneratePointsCommand } from './commands/generate-points';

const gameStateSubscribedRoom = 'gameStateSubscribedRoom';

export class GameServer extends CommandReceiver {
  private objects!: PhysicalContainer;
  private players!: PlayerContainer;
  private deltaTimes!: Array<number>;
  private deltaTimeCalculator!: DeltaTimeCalculator;

  private declaPoints = 0;
  private redPoints = 0;

  private isInEndGame = false;
  private timeScaling = 1;

  private serverName: string;
  private playerLimit: number;

  private initialize() {
    const previousPlayers = this.players;
    this.objects = new PhysicalContainer();
    createWorld(this.objects, this.options.worldSize);
    this.objects.initialize();
    this.players = new PlayerContainer(
      this.objects,
      this.options.playerLimit,
      this.options.npcCount,
    );
    this.deltaTimeCalculator = new DeltaTimeCalculator();
    this.deltaTimes = [];
    this.declaPoints = 0;
    this.redPoints = 0;
    this.isInEndGame = false;
    this.timeScaling = 1;
    previousPlayers?.queueCommandForEachClient(new GameStartCommand());
    previousPlayers?.sendQueuedCommands();
  }

  protected commandExecutors: CommandExecutors = {
    [GeneratePointsCommand.type]: this.addPoints.bind(this),
  };

  constructor(private readonly io: ioserver.Server, private options: Options) {
    super();

    this.serverName = options.name;
    this.playerLimit = options.playerLimit;

    this.initialize();

    io.on('connection', (socket: SocketIO.Socket) => {
      socket.on(TransportEvents.PlayerJoining, (playerInfo: PlayerInformation) => {
        try {
          const player = this.players.createPlayer(playerInfo, socket);
          socket.on(TransportEvents.PlayerToServer, (json: string) => {
            try {
              const commands: Array<Command> = deserialize(json);
              commands.forEach((c) => player.handleCommand(c));
            } catch (e) {
              console.error('Error while processing command', e);
            }
          });

          this.sendServerStateUpdate();

          socket.on('disconnect', () => {
            player.destroy();
            this.players.deletePlayer(player);
            this.sendServerStateUpdate();
          });
        } catch {
          socket.disconnect();
        }
      });

      socket.on(TransportEvents.SubscribeForServerInfoUpdates, () => {
        socket.join(gameStateSubscribedRoom);
      });
    });
  }

  private timeSinceLastServerStateUpdate = 0;
  public sendServerStateUpdate() {
    this.io
      .to(gameStateSubscribedRoom)
      .emit(TransportEvents.ServerInfoUpdate, [this.players.count, this.gameProgress]);
  }

  public start() {
    this.handlePhysics();
  }

  private addPoints({ decla, red }: GeneratePointsCommand) {
    if (this.isInEndGame) {
      return;
    }

    this.declaPoints += decla;
    this.redPoints += red;
    if (this.declaPoints >= this.options.scoreLimit) {
      this.endGame(CharacterTeam.decla);
    } else if (this.redPoints >= this.options.scoreLimit) {
      this.endGame(CharacterTeam.red);
    }
  }

  private endGame(winningTeam: CharacterTeam) {
    this.isInEndGame = true;
    const endTitleLength = 6;
    this.players.endGame(winningTeam);
    this.players.queueCommandForEachClient(
      new GameEndCommand(winningTeam, endTitleLength, true),
    );
    setTimeout(() => this.destroy(), endTitleLength * 1000 * 1.1);
  }

  private destroy() {
    this.initialize();
  }

  private timeSinceLastPointUpdate = 0;

  private handlePhysics() {
    const delta = this.deltaTimeCalculator.getNextDeltaTimeInSeconds({ setAsBase: true });
    this.deltaTimes.push(delta);

    this.handleStats();

    if ((this.timeSinceLastServerStateUpdate += delta) > 4) {
      this.timeSinceLastServerStateUpdate = 0;
      this.sendServerStateUpdate();
    }

    if ((this.timeSinceLastPointUpdate += delta) > 0.5) {
      this.timeSinceLastPointUpdate = 0;
      this.players.queueCommandForEachClient(
        new UpdateGameState(this.declaPoints, this.redPoints, this.options.scoreLimit),
      );
    }

    let scaledDelta = delta;
    if (this.isInEndGame) {
      this.timeScaling *= Math.pow(settings.endGameDeltaScaling, delta);
      scaledDelta /= this.timeScaling;
    }

    this.objects.handleCommand(new StepCommand(scaledDelta, this));
    this.players.step(scaledDelta);
    this.players.stepCommunication(delta);
    this.objects.resetRemoteCalls();

    const physicsDelta = this.deltaTimeCalculator.getNextDeltaTimeInSeconds();

    setTimeout(
      this.handlePhysics.bind(this),
      Math.max(0, settings.targetPhysicsDeltaTimeInSeconds - physicsDelta) * 1000,
    );
  }

  private handleStats() {
    const framesBetweenDeltaTimeCalculation = 10000;

    if (this.deltaTimes.length > framesBetweenDeltaTimeCalculation) {
      this.deltaTimes.sort((a, b) => a - b);
      console.info(
        `Median physics time: ${(
          this.deltaTimes[Math.floor(framesBetweenDeltaTimeCalculation / 2)] * 1000
        ).toFixed(2)} ms`,
      );
      console.info(
        'Tail times: ',
        this.deltaTimes.slice(-20).map((v) => `${(v * 1000).toFixed(2)} ms`),
      );
      console.info(
        `Memory used: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      );
      this.deltaTimes = [];
    }
  }

  private get gameProgress(): number {
    return (Math.max(this.declaPoints, this.redPoints) / this.options.scoreLimit) * 100;
  }

  public get serverInfo(): ServerInformation {
    return {
      serverName: this.serverName,
      playerCount: this.players.count,
      playerLimit: this.playerLimit,
      gameStatePercent: this.gameProgress,
    };
  }
}
