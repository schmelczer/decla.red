import { Id } from '../../transport/identity';
import { Command } from '../command';

export class DeleteObjectsCommand extends Command {
  public constructor(public readonly ids: Array<Id>) {
    super();
  }

  public toJSON(): any {
    return [this.type, this.ids];
  }
}
