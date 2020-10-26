import { Renderer } from 'sdf-2d';
import {
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  Id,
  RemoteCallsForObjects,
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
      if (this.camera) {
        this.deleteObject(this.camera.id);
      }

      this.player = c.character as PlayerCharacterView;
      this.player.isMainCharacter = true;

      this.camera = new Camera(this.game);

      this.addObject(this.player);
      this.addObject(this.camera);
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => this.addObject(o as ViewObject)),

    [RemoteCallsForObjects.type]: (c: RemoteCallsForObjects) =>
      c.callsForObjects.forEach((c) =>
        this.objects.get(c.id)?.processRemoteCalls(c.calls),
      ),

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.deleteObject(id)),
  };

  constructor(private game: Game) {
    super();
  }

  public stepObjects(deltaTimeInSeconds: number) {
    if (this.player) {
      this.camera.center = this.player.position;
    }

    this.objects.forEach((o) => o.step(deltaTimeInSeconds));
  }

  public drawObjects(
    renderer: Renderer,
    overlay: HTMLElement,
    shouldChangeLayout: boolean,
  ) {
    this.objects.forEach((o) => o.draw(renderer, overlay, shouldChangeLayout));
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
