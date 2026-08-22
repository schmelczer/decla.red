export interface PlayerInformation {
  name: string;
  // Issued by the server on a previous join. Presented on reconnect to reclaim
  // the team and score held during the grace window; absent on a first join.
  reconnectToken?: string;
}
