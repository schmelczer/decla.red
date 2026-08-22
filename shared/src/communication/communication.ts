export type Id = number | null;

let currentId = 0;
export const id = (): number => {
  return currentId++;
};

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
