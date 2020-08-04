import { Command } from '../commands/command';
import { CommandReceiver } from '../commands/command-receiver';
import { Id } from '../identity/identity';
import { GameObject } from './game-object';

export class Objects implements CommandReceiver {
  private objects: Map<Id, GameObject> = new Map();
  private objectsGroupedByAbilities: Map<string, Array<GameObject>> = new Map();

  public addObject(o: GameObject) {
    this.objects.set(o.id, o);

    for (let command of this.objectsGroupedByAbilities.keys()) {
      if (o.reactsToCommand(command)) {
        this.objectsGroupedByAbilities.get(command).push(o);
      }
    }
  }

  public removeObject(o: GameObject) {
    this.objects.delete(o.id);
  }

  public sendCommandToSingleObject(id: Id, e: Command) {
    this.objects.get(id)?.sendCommand(e);
  }

  public sendCommand(e: Command) {
    if (!this.objectsGroupedByAbilities.has(e.type)) {
      this.createGroupForCommand(e.type);
    }

    this.objectsGroupedByAbilities
      .get(e.type)
      .forEach((o, _) => o.sendCommand(e));
  }

  private createGroupForCommand(commandType: string) {
    const objectsReactingToCommand = [];

    this.objects.forEach((o, _) => {
      if (o.reactsToCommand(commandType)) {
        objectsReactingToCommand.push(o);
      }
    });

    this.objectsGroupedByAbilities.set(commandType, objectsReactingToCommand);
  }
}
