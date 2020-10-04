import { Socket } from 'dgram';

export class Player {
  constructor(private readonly socket: SocketIO.Socket) {}

  public get socketId(): string {
    return this.socket.id;
  }
}
