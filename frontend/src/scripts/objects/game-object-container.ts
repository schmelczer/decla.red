import {
  Command,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  GameObject,
  Id,
  UpdateObjectsCommand,
} from 'shared';
import { StepCommand } from '../commands/types/step';
import { deserialize, deserializeJsonArray } from '../transport/deserialize';
import { Camera } from './camera';
import { CharacterView } from './character-view';

export class GameObjectContainer extends CommandReceiver {
  protected objects: Map<Id, GameObject> = new Map();
  public player: CharacterView;
  public camera: Camera;

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = deserialize(c.serializedPlayer) as CharacterView;
      this.camera = new Camera();
      this.addObject(this.player);
      this.addObject(this.camera);
    },

    [StepCommand.type]: (c: StepCommand) => {
      if (this.player) {
        this.camera.center = this.player.position;
      }
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      deserializeJsonArray(c.serializedObjects).forEach((o) => this.addObject(o)),

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.objects.delete(id)),

    [UpdateObjectsCommand.type]: (c: UpdateObjectsCommand) =>
      deserializeJsonArray(c.serializedObjects).forEach((o) => {
        this.objects.delete(o.id);
        this.addObject(o);
        if (o.id === this.player.id) {
          this.player = o as CharacterView;
        }
      }),
  };

  protected defaultCommandExecutor(c: Command) {
    this.objects.forEach((o) => o.sendCommand(c));
  }

  public sendCommandToSingleObject(id: Id, e: Command) {
    this.objects.get(id)!.sendCommand(e);
  }

  private addObject(object: GameObject) {
    this.objects.set(object.id, object);
  }
}
