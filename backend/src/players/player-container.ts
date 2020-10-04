import { Player } from './player';

export class PlayerContainer {
  private socketIdToPlayer = new Map<string, Player>();

  public addPlayer(player: Player) {
    this.socketIdToPlayer.set(player.socketId, player);
  }

  public removePlayerBySocketId(socketId: string) {
    this.socketIdToPlayer.delete(socketId);
  }
}
