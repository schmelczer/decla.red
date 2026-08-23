import {
  CharacterTeam,
  PlayerInformation,
  Random,
  settings,
  Command,
  GameObject,
  PropertyUpdatesForObject,
} from 'shared';
import { Socket } from 'socket.io';
import { PhysicalContainer } from '../physics/physical-container';
import { NPC } from './npc';
import { Player } from './player';
import { PlayerBase, Score } from './player-base';

export interface CarriedScore extends Score {
  team: CharacterTeam;
}

export class PlayerContainer {
  private _players: Array<Player> = [];
  private npcs: Array<NPC> = [];

  constructor(
    private readonly objects: PhysicalContainer,
    private readonly playerMaxCount: number,
    private readonly npcMaxCount: number,
  ) {
    this.createNPCs();
  }

  private createNPCs() {
    const newNpcCount = Math.min(
      this.playerMaxCount - this._players.length - this.npcs.length,
      this.npcMaxCount - this.npcs.length,
    );
    for (let i = 0; i < newNpcCount; i++) {
      const name = `🤖 ${Random.choose(settings.npcNames)}`;
      this.npcs.push(
        new NPC({ name }, this, this.objects, this.getTeamOfNextPlayer(true)),
      );
    }
  }

  public createPlayer(
    playerInfo: PlayerInformation,
    socket: Socket,
    carried?: CarriedScore,
  ): Player {
    const team = carried ? carried.team : this.getTeamOfNextPlayer();

    const npcToReplace =
      this.npcs.find((n) => n.team === team) ?? this.npcs.find((n) => n.team !== team);
    npcToReplace?.destroy();
    this.npcs = this.npcs.filter((n) => n !== npcToReplace);

    const player = new Player(playerInfo, this, this.objects, team, socket, carried);
    this._players.push(player);
    return player;
  }

  public get players(): Array<PlayerBase> {
    return [...this._players, ...this.npcs];
  }

  public get count(): number {
    return this._players.length;
  }

  public get isFull(): boolean {
    return this._players.length >= this.playerMaxCount;
  }

  public get connectedPlayerRttsMs(): Array<number> {
    return this._players.map((p) => p.rttMs);
  }

  public step(deltaTimeInSeconds: number) {
    this._players.forEach((p) => p.step(deltaTimeInSeconds));
    this.npcs.forEach((p) => p.step(deltaTimeInSeconds));
  }

  public stepCommunication(
    deltaTimeInSeconds: number,
    propertyUpdatesOf: (object: GameObject) => PropertyUpdatesForObject | undefined,
  ) {
    this._players.forEach((p) =>
      p.stepCommunications(deltaTimeInSeconds, propertyUpdatesOf),
    );
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
    if (this._players.includes(player)) {
      this._players = this._players.filter((p) => p !== player);
      this.createNPCs();
    }
  }
}
