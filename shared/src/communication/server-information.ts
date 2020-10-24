export interface ServerInformation {
  playerLimit: number;
  playerCount: number;
  serverName: string;
  gameStatePercent: number;
}

export const serverInformationEndpoint = '/state';
