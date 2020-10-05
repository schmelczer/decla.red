import { Command, CommandReceiver, TransportEvents } from 'shared';

export class CommandReceiverSocket extends CommandReceiver {
  constructor(private readonly socket: SocketIOClient.Socket) {
    super();
  }

  protected defaultCommandExecutor(command: Command) {
    this.socket.emit(TransportEvents.PlayerToServer, JSON.stringify(command));
  }
}
