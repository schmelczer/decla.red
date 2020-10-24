import { CharacterTeam, PlayerInformation, Random, TransportEvents } from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { Player } from './player';

export class PlayerContainer {
  private _players: Array<Player> = [];

  constructor(private readonly objects: PhysicalContainer) {}

  public createPlayer(playerInfo: PlayerInformation, socket: SocketIO.Socket): Player {
    const player = new Player(
      playerInfo,
      this,
      this.objects,
      socket,
      this.getTeamOfNextPlayer(),
    );
    this._players.push(player);

    return player;
  }

  public get players(): Array<Player> {
    return this._players;
  }

  public get count(): number {
    return this.players.length;
  }

  public step(deltaTimeInSeconds: number) {
    this.players.forEach((p) => p.step(deltaTimeInSeconds));
  }

  public sendOnSocket(message: any) {
    this.players.forEach((p) => p.socket.emit(TransportEvents.ServerToPlayer, message));
  }

  private getTeamOfNextPlayer(): CharacterTeam {
    const declaCount = this._players.filter((p) => p.team === CharacterTeam.decla).length;
    const redCount = this._players.filter((p) => p.team === CharacterTeam.red).length;

    if ((declaCount === redCount && Random.getRandom() >= 0.5) || declaCount < redCount) {
      return CharacterTeam.decla;
    } else {
      return CharacterTeam.red;
    }
  }

  public deletePlayer(player: Player) {
    this._players = this._players.filter((p) => p !== player);
  }
}
