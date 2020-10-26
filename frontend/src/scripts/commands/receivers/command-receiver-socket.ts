import { Command, CommandReceiver, serialize, TransportEvents } from 'shared';

export class CommandReceiverSocket extends CommandReceiver {
  constructor(private readonly socket: SocketIOClient.Socket) {
    super();
  }

  private commandQueue: Array<Command> = [];
  protected defaultCommandExecutor(command: Command) {
    this.commandQueue.push(command);
  }

  public sendQueuedCommands() {
    if (this.commandQueue.length > 0) {
      this.socket.emit(TransportEvents.PlayerToServer, serialize(this.commandQueue));
      this.commandQueue = [];
    }
  }
}
