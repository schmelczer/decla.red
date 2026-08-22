import { CharacterTeam, PlayerInformation, Random, settings, Command } from 'shared';
import { Socket } from 'socket.io';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { NPC } from './npc';
import { Player } from './player';
import { PlayerBase } from './player-base';
import { ServerFullError } from './server-full-error';
import { randomUUID } from 'node:crypto';

// Score held for a player whose socket dropped, so a reconnect inside the grace
// window resumes the match instead of starting from zero.
interface ReservedScore {
  team: CharacterTeam;
  kills: number;
  deaths: number;
  expiresAtMs: number;
}

export class PlayerContainer {
  private _players: Array<Player> = [];
  private _npcs: Array<NPC> = [];
  private reservedScores = new Map<string, ReservedScore>();

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
    if (this._players.length >= this.playerMaxCount) {
      throw new ServerFullError();
    }

    const reserved = this.claimReservedScore(playerInfo.reconnectToken);
    const team = reserved ? reserved.team : this.getTeamOfNextPlayer();

    const player = new Player(playerInfo, this, this.objects, team, socket);

    let npcToReplace = this._npcs.find((n) => n.team === team);
    if (!npcToReplace) {
      npcToReplace = this._npcs.find((n) => n.team !== team);
    }
    npcToReplace?.destroy();
    this._npcs = this._npcs.filter((n) => n !== npcToReplace);

    this._players.push(player);

    if (reserved) {
      player.restoreScore(reserved.kills, reserved.deaths);
    }

    return player;
  }

  /**
   * A fresh token for a joining player. Handed to the client immediately; it
   * only becomes redeemable once the player actually drops (see reserveScore).
   */
  public issueToken(): string {
    return randomUUID();
  }

  /**
   * Hold a dropped player's team and score against its token for the grace
   * window, so a client whose transport blipped rejoins as itself.
   */
  public reserveScore(
    token: string,
    team: CharacterTeam,
    kills: number,
    deaths: number,
    nowMs: number,
  ) {
    this.expireReservations(nowMs);
    this.reservedScores.set(token, {
      team,
      kills,
      deaths,
      expiresAtMs: nowMs + settings.reconnectGraceSeconds * 1000,
    });
  }

  private claimReservedScore(token?: string): ReservedScore | undefined {
    if (!token || typeof token !== 'string') {
      return undefined;
    }
    const reserved = this.reservedScores.get(token);
    if (!reserved) {
      return undefined;
    }
    this.reservedScores.delete(token);
    return reserved;
  }

  private expireReservations(nowMs: number) {
    for (const [token, reserved] of this.reservedScores) {
      if (reserved.expiresAtMs <= nowMs) {
        this.reservedScores.delete(token);
      }
    }
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
    const had = this._players.includes(player);
    this._players = this._players.filter((p) => p !== player);
    // Only refill bots if this player was actually ours. A socket left over from
    // a previous round reports its disconnect against the new container, and
    // topping up on that would over-fill the roster.
    if (had) {
      this.createNPCs();
    }
  }
}
