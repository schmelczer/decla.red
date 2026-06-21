import { CharacterTeam, PlayerInformation, Random, settings, Command } from 'shared';
import { Socket } from 'socket.io';
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
      const name = `🤖 ${Random.choose(settings.npcNames)}`;
      this._npcs.push(
        new NPC({ name }, this, this.objects, this.getTeamOfNextPlayer(true)),
      );
    }
  }

  public createPlayer(playerInfo: PlayerInformation, socket: Socket): Player {
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

  // Measured round-trip times (ms) of the real connected players, for
  // server-side latency stats. NPCs have no socket and are excluded.
  public get connectedPlayerRttsMs(): Array<number> {
    return this._players.map((p) => p.rttMs);
  }

  public step(deltaTimeInSeconds: number) {
    this.players.forEach((p) => p.step(deltaTimeInSeconds));
  }

  public stepCommunication(deltaTimeInSeconds: number) {
    this._players.forEach((p) => p.stepCommunications(deltaTimeInSeconds));
  }

  public endGame(winner: CharacterTeam) {
    this._players.forEach((p) => p.onGameEnded(winner));
  }

  public queueCommandForEachClient(command: Command) {
    this._players.forEach((p) => p.queueCommandSend(command));
  }

  public sendQueuedCommands() {
    this._players.forEach((p) => p.sendQueuedCommandsToClient());
  }

  private getTeamOfNextPlayer(isNpc = false): CharacterTeam {
    const players = isNpc ? this.players : this._players;
    const blueCount = players.filter((p) => p.team === CharacterTeam.blue).length;
    const redCount = players.filter((p) => p.team === CharacterTeam.red).length;

    if ((blueCount === redCount && Random.getRandom() >= 0.5) || blueCount < redCount) {
      return CharacterTeam.blue;
    } else {
      return CharacterTeam.red;
    }
  }

  public deletePlayer(player: Player) {
    this._players = this._players.filter((p) => p !== player);
    this.createNPCs();
  }
}
