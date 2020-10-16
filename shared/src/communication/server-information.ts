export interface ServerInformation {
  playerLimit: number;
  playerCount: number;
  serverName: string;
}

export const serverInformationEndpoint = '/stats';
