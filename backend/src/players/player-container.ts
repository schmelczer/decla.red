import { CharacterTeam, PlayerInformation, Random, settings, Command } from 'shared';
import { Socket } from 'socket.io';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { NPC } from './npc';
import { Player } from './player';
import { PlayerBase } from './player-base';
import { ServerFullError } from './server-full-error';

// Team and score carried over from the connection a reconnecting client is
// replacing, so it resumes the match instead of starting from zero.
export interface CarriedScore {
  team: CharacterTeam;
  kills: number;
  deaths: number;
}

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

  public createPlayer(
    playerInfo: PlayerInformation,
    socket: Socket,
    carried?: CarriedScore,
  ): Player {
    if (this._players.length >= this.playerMaxCount) {
      throw new ServerFullError();
    }

    const team = carried ? carried.team : this.getTeamOfNextPlayer();

    // Retire the bot before the player spawns: its body would otherwise push
    // the spawn search away from the position it picked.
    const npcToReplace =
      this._npcs.find((n) => n.team === team) ?? this._npcs.find((n) => n.team !== team);
    npcToReplace?.destroy();
    this._npcs = this._npcs.filter((n) => n !== npcToReplace);

    const player = new Player(playerInfo, this, this.objects, team, socket);
    this._players.push(player);

    if (carried) {
      player.restoreScore(carried.kills, carried.deaths);
    }

    return player;
  }

  public get players(): Array<PlayerBase> {
    return [...this._players, ...this._npcs];
  }

  public get count(): number {
    return this._players.length;
  }

  public get isFull(): boolean {
    return this._players.length >= this.playerMaxCount;
  }

  // Real connected players only — NPCs have no socket and are excluded.
  public get connectedPlayerRttsMs(): Array<number> {
    return this._players.map((p) => p.rttMs);
  }

  public step(deltaTimeInSeconds: number) {
    // Iterate the backing arrays directly: this runs per 200 Hz substep and the
    // `players` getter allocates a new array every call.
    this._players.forEach((p) => p.step(deltaTimeInSeconds));
    this._npcs.forEach((p) => p.step(deltaTimeInSeconds));
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
    const had = this._players.includes(player);
    this._players = this._players.filter((p) => p !== player);
    // Only refill bots if this player was actually ours: a stale socket from a
    // previous round reports its disconnect against the new container, and
    // topping up on that would over-fill the roster.
    if (had) {
      this.createNPCs();
    }
  }
}
