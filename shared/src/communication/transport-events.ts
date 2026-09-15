export enum TransportEvents {
  PlayerJoining = 'PlayerJoining',
  PlayerToServer = 'PlayerToServer',
  ServerToPlayer = 'ServerToPlayer',
  SubscribeForServerInfoUpdates = 'SubscribeForServerInfoUpdates',
  ServerInfoUpdate = 'ServerInfoUpdate',
  Ping = 'Ping',
  Pong = 'Pong',
  PlayerJoined = 'PlayerJoined',
  JoinRejected = 'JoinRejected',
}

export enum JoinRejectionReason {
  ServerFull = 'ServerFull',
  RoundEnding = 'RoundEnding',
  AlreadyJoined = 'AlreadyJoined',
  InvalidRequest = 'InvalidRequest',
}
