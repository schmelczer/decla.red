import {
  Command,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  GameObject,
  Id,
  PropertyUpdatesForObjects,
  RemoteCallsForObjects,
} from 'shared';
import { BeforeDestroyCommand } from '../commands/types/before-destroy';
import { StepCommand } from '../commands/types/step';
import { Game } from '../game';
import { Camera } from './types/camera';
import { CharacterView } from './types/character-view';

export class GameObjectContainer extends CommandReceiver {
  protected objects: Map<Id, GameObject> = new Map();
  public player!: CharacterView;
  public camera: Camera = new Camera(this.game);

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.player.isMainCharacter = true;
      this.addObject(this.player);
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => this.addObject(o as GameObject)),

    [StepCommand.type]: (c: StepCommand) => {
      this.defaultCommandExecutor(c);

      if (this.player) {
        this.camera.center = this.player.position;
      }
    },

    [RemoteCallsForObjects.type]: (c: RemoteCallsForObjects) =>
      c.callsForObjects.forEach((c) =>
        this.objects.get(c.id)?.processRemoteCalls(c.calls),
      ),

    [PropertyUpdatesForObjects.type]: (c: PropertyUpdatesForObjects) =>
      c.updates.forEach((u) =>
        u.updates.forEach((au) => this.objects.get(u.id)?.handleCommand(au)),
      ),

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.deleteObject(id)),
  };

  constructor(private game: Game) {
    super();
  }

  protected defaultCommandExecutor(c: Command) {
    this.objects.forEach((o) => o.handleCommand(c));
    this.camera.handleCommand(c);
  }

  private addObject(object: GameObject) {
    this.objects.set(object.id, object);
  }

  private deleteObject(id: Id) {
    const object = this.objects.get(id);
    object?.handleCommand(new BeforeDestroyCommand());
    this.objects.delete(id);
  }
}
