export class ServerFullError extends Error {
  constructor() {
    super('Too many players');
  }
}
