import {
  ClientHeartbeatCommand,
  Command,
  serialize,
  settings,
  TransportEvents,
} from 'shared';
import { Socket } from 'socket.io-client';
import { clientTimeMs } from '../helper/prediction/local-character-predictor';

const heartbeatIntervalMs = settings.clientSendInterval * 1000;
// At an exact frame-rate/interval ratio (60 Hz vs 30 Hz) float noise would otherwise drop every third beat.
const dueToleranceMs = 1;

export class CommandSocket {
  private commandQueue: Array<Command> = [];
  private lastSendMs = -Infinity;

  constructor(private readonly socket: Socket) {}

  public queue(command: Command) {
    this.commandQueue.push(command);
  }

  public reset() {
    this.commandQueue = [];
    this.lastSendMs = -Infinity;
  }

  public sendQueuedCommands() {
    // socket.io-client would buffer emits made while disconnected and flush them before the re-join.
    if (!this.socket.connected) {
      this.commandQueue = [];
      return;
    }

    const nowMs = clientTimeMs();
    if (
      this.commandQueue.length === 0 &&
      nowMs - this.lastSendMs < heartbeatIntervalMs - dueToleranceMs
    ) {
      return;
    }
    this.lastSendMs = nowMs;

    this.commandQueue.push(new ClientHeartbeatCommand(nowMs));
    this.socket.emit(TransportEvents.PlayerToServer, serialize(this.commandQueue));
    this.commandQueue = [];
  }
}
