import {
  ClientHeartbeatCommand,
  Command,
  CommandReceiver,
  serialize,
  settings,
  TransportEvents,
} from 'shared';
import { Socket } from 'socket.io-client';
import { predictorNowMs } from '../helper/prediction/local-character-predictor';

const heartbeatIntervalMs = settings.clientSendInterval * 1000;

// A frame that lands a hair short of the deadline still counts as due. At an
// exact ratio of frame rate to interval — 60 Hz against 30 Hz — whether the gap
// compares as reached is decided by floating-point noise, and the heartbeat
// slips a whole frame every third beat, drifting to ~21 Hz instead of 30.
const dueToleranceMs = 1;

export class CommandSocket extends CommandReceiver {
  constructor(private readonly socket: Socket) {
    super();
  }

  private commandQueue: Array<Command> = [];
  private lastSendMs = -Infinity;

  protected defaultCommandExecutor(command: Command) {
    this.commandQueue.push(command);
  }

  public sendQueuedCommands() {
    // Nothing goes out while the transport is down. socket.io-client would
    // otherwise buffer every emit in an uncapped sendBuffer and flush it on
    // reconnect BEFORE the `connect` handler re-sends PlayerJoining — the
    // server has no PlayerToServer listener attached yet and drops the lot.
    // The local queue is dropped with it: these are timestamped inputs, and
    // replaying a minute-old shot after the gap would be worse than losing it.
    if (!this.socket.connected) {
      this.commandQueue = [];
      return;
    }

    const nowMs = predictorNowMs();

    // Real input goes out on the frame it happens — that is the latency budget the player feels. An idle client still keeps the server's input acknowledgement moving (a held key generates no fresh command), paced by the clock not the frame rate; sending every rendered frame would exceed settings.maxInboundMessagesPerSecond, and since movement commands are edge-triggered and never re-sent, a discarded batch would drop the direction change for good.
    if (
      this.commandQueue.length === 0 &&
      nowMs - this.lastSendMs < heartbeatIntervalMs - dueToleranceMs
    ) {
      return;
    }
    this.lastSendMs = nowMs;

    this.commandQueue.push(new ClientHeartbeatCommand(Math.round(nowMs)));
    this.socket.emit(TransportEvents.PlayerToServer, serialize(this.commandQueue));
    this.commandQueue = [];
  }
}
