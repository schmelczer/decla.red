import { GameObject } from './game-object';
import { Id } from '../identity/identity';
import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';

export class ObjectContainer implements CommandReceiver {
  private objects: Map<Id, GameObject> = new Map();

  public addObject(o: GameObject) {
    this.objects.set(o.id, o);
  }

  public removeObject(o: GameObject) {
    this.objects.delete(o.id);
  }

  public sendCommandToSingleObject(id: Id, e: Command) {
    this.objects.get(id)?.sendCommand(e);
  }

  public sendCommand(e: Command) {
    this.objects.forEach((o, _) => o.sendCommand(e));
  }
}
