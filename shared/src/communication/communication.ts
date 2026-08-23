export type Id = number;

let currentId = 0;
export const id = (): Id => currentId++;

export interface PlayerInformation {
  name: string;
  reconnectToken?: string;
}

export interface ServerInformation {
  playerLimit: number;
  playerCount: number;
  serverName: string;
  gameStatePercent: number;
}

export const serverInformationEndpoint = '/state';
