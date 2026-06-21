import { Command } from 'shared';

// Internal request from a game object (e.g. a keystone planet flipping) asking
// the GameServer to broadcast a one-off announcement to every connected client.
export class AnnounceCommand extends Command {
  public constructor(public readonly text: string) {
    super();
  }
}
