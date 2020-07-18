import { Command } from './command';

export interface CommandReceiver {
  sendCommand(command: Command): void;
}
