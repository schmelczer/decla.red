import { CommandReceiver } from './command-receiver';
import { CommandGenerator } from './command-generator';

export const broadcastCommands = (
  commandGenerators: Array<CommandGenerator>,
  commandReceivers: Array<CommandReceiver>,
) => commandReceivers.forEach((r) => commandGenerators.forEach((g) => g.subscribe(r)));
