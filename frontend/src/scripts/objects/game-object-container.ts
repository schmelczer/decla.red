import { Renderer } from 'sdf-2d';
import {
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  GameObject,
  Id,
  UpdateObjectsCommand,
} from 'shared';
import { Game } from '../game';
import { Camera } from './camera';
import { PlayerCharacterView } from './player-character-view';
import { ViewObject } from './view-object';

export class GameObjectContainer extends CommandReceiver {
  protected objects: Map<Id, ViewObject> = new Map();
  public player!: PlayerCharacterView;
  public camera!: Camera;

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as PlayerCharacterView;
      console.log(c.character);
      this.camera = new Camera(this.game);
      this.addObject(this.player);
      this.addObject(this.camera);
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => this.addObject(o as ViewObject)),

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.deleteObject(id)),

    [UpdateObjectsCommand.type]: (c: UpdateObjectsCommand) => {
      c.updates.forEach((u) => this.objects.get(u.id)?.update(u.updates));
    },
  };

  constructor(private game: Game) {
    super();
  }

  public stepObjects(delta: number) {
    if (this.player) {
      this.camera.center = this.player.position;
    }

    this.objects.forEach((o) => o.step(delta));
  }

  public drawObjects(renderer: Renderer, overlay: HTMLElement) {
    this.objects.forEach((o) => o.draw(renderer, overlay));
  }

  private addObject(object: ViewObject) {
    this.objects.set(object.id, object);
  }

  private deleteObject(id: Id) {
    const object = this.objects.get(id);
    object?.beforeDestroy();
    this.objects.delete(id);
  }
}
