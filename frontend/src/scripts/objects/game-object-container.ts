import {
  Command,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  GameObject,
  Id,
  StepCommand,
  UpdateObjectsCommand,
} from 'shared';
import { Game } from '../game';
import { Camera } from './camera';
import { CharacterView } from './character-view';

export class GameObjectContainer extends CommandReceiver {
  protected objects: Map<Id, GameObject> = new Map();
  public player: CharacterView;
  public camera: Camera;

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.camera = new Camera(this.game);
      this.addObject(this.player);
      this.addObject(this.camera);
    },

    [StepCommand.type]: (_: StepCommand) => {
      if (this.player) {
        this.camera.center = this.player.position;
      }
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => this.addObject(o)),

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.objects.delete(id)),

    [UpdateObjectsCommand.type]: (c: UpdateObjectsCommand) => {
      c.objects.forEach((o) => {
        this.objects.delete(o.id);
        this.addObject(o);
        if (o.id === this.player.id) {
          this.player = o as CharacterView;
        }
      });
    },
  };

  constructor(private game: Game) {
    super();
  }

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
