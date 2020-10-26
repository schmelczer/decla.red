import { CharacterTeam, PlayerInformation, Random, settings, Command } from 'shared';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { NPC } from './npc';
import { Player } from './player';
import { PlayerBase } from './player-base';

export class PlayerContainer {
  private _players: Array<Player> = [];
  private _npcs: Array<NPC> = [];

  constructor(
    private readonly objects: PhysicalContainer,
    private readonly playerMaxCount: number,
    private readonly npcMaxCount: number,
  ) {
    this.createNPCs();
  }

  public createNPCs() {
    const newNpcCount = Math.min(
      this.playerMaxCount - this._players.length - this._npcs.length,
      this.npcMaxCount - this._npcs.length,
    );
    for (let i = 0; i < newNpcCount; i++) {
      const name = `BOT ${Random.choose(settings.npcNames)}`;
      this._npcs.push(
        new NPC({ name }, this, this.objects, this.getTeamOfNextPlayer(true)),
      );
    }
  }

  public createPlayer(playerInfo: PlayerInformation, socket: SocketIO.Socket): Player {
    if (this._players.length === this.playerMaxCount) {
      throw new Error('Too many players');
    }

    const team = this.getTeamOfNextPlayer();
    let npcToReplace = this._npcs.find((n) => n.team === team);
    if (!npcToReplace) {
      npcToReplace = this._npcs.find((n) => n.team !== team);
    }
    npcToReplace?.destroy();
    this._npcs = this._npcs.filter((n) => n !== npcToReplace);

    const player = new Player(playerInfo, this, this.objects, team, socket);
    this._players.push(player);

    return player;
  }

  public get players(): Array<PlayerBase> {
    return [...this._players, ...this._npcs];
  }

  public get count(): number {
    return this._players.length;
  }

  public step(deltaTimeInSeconds: number) {
    this.players.forEach((p) => p.step(deltaTimeInSeconds));
  }

  public queueCommandForEachClient(command: Command) {
    this._players.forEach((p) => p.queueCommandSend(command));
  }

  public sendQueuedCommands() {
    this._players.forEach((p) => p.sendQueuedCommandsToClient());
  }

  private getTeamOfNextPlayer(isNpc = false): CharacterTeam {
    const players = isNpc ? this.players : this._players;
    const declaCount = players.filter((p) => p.team === CharacterTeam.decla).length;
    const redCount = players.filter((p) => p.team === CharacterTeam.red).length;

    if ((declaCount === redCount && Random.getRandom() >= 0.5) || declaCount < redCount) {
      return CharacterTeam.decla;
    } else {
      return CharacterTeam.red;
    }
  }

  public deletePlayer(player: Player) {
    this._players = this._players.filter((p) => p !== player);
    this.createNPCs();
  }
}
