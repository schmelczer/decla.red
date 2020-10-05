import { Command } from '../command';

export class UpdateObjectsCommand extends Command {
  public static readonly type = 'UpdateObjectsCommand';

  public constructor(public readonly serializedObjects: string) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.serializedObjects];
  }
}
