import { Renderer } from 'sdf-2d';
import {
  Circle,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  Id,
  PropertyUpdatesForObjects,
  RemoteCallsForObjects,
  settings,
  UpdatePropertyCommand,
} from 'shared';
import { FeedbackHud } from '../feedback-hud';
import { Game } from '../game';
import { serverTimeline } from '../helper/server-timeline';
import { localCharacterPredictor } from '../helper/prediction/local-character-predictor';
import { Camera } from './types/camera';
import { CharacterView } from './types/character-view';
import { PlanetView } from './types/planet-view';
import { View } from './view';

export class GameObjectContainer extends CommandReceiver {
  public player?: CharacterView;
  public readonly camera: Camera;
  public planets: Array<PlanetView> = [];

  private objects: Map<Id, View> = new Map();
  private wasLocalPlayerAlive = false;

  // Creates and deletes take effect on the render timeline, not on arrival.
  private visibleFrom = new Map<Id, number>();
  private deleteAt = new Map<Id, number>();
  private awaitingCreateStamp: Array<Id> = [];
  private awaitingDeleteStamp: Array<Id> = [];

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.player.isMainCharacter = true;
      this.addObject(this.player);
      localCharacterPredictor.reset();
      FeedbackHud.hideElimination();
      this.wasLocalPlayerAlive = true;
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => {
        this.addObject(o as View);
        this.awaitingCreateStamp.push(o.id);
      }),

    [RemoteCallsForObjects.type]: (c: RemoteCallsForObjects) =>
      c.callsForObjects.forEach((c) =>
        this.objects.get(c.id)?.processRemoteCalls(c.calls),
      ),

    [PropertyUpdatesForObjects.type]: (c: PropertyUpdatesForObjects) => {
      serverTimeline.onSnapshot(c.timestamp);
      this.stampPending(c.timestamp);
      c.updates.forEach((u) => {
        const object = this.objects.get(u.id);
        u.updates.forEach((au) => object?.updateProperty?.(au));
        if (object && object === this.player) {
          this.feedPredictor(u.updates);
        }
      });
    },

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.awaitingDeleteStamp.push(id)),
  };

  constructor(game: Game) {
    super();
    this.camera = new Camera(game);
  }

  public reset() {
    this.objects.forEach((o) => o.beforeDestroy?.());
    this.objects.clear();
    this.planets = [];
    this.visibleFrom.clear();
    this.deleteAt.clear();
    this.awaitingCreateStamp = [];
    this.awaitingDeleteStamp = [];
    this.wasLocalPlayerAlive = false;
  }

  public get localPlayer(): CharacterView | undefined {
    return this.player && this.objects.has(this.player.id) ? this.player : undefined;
  }

  public step(deltaTimeInSeconds: number) {
    this.stampPending(serverTimeline.snapshotTime);
    this.retireDueObjects();
    this.objects.forEach((o) => o.step(deltaTimeInSeconds));

    const player = this.localPlayer;
    const alive = !!player && player.health > 0;
    if (this.wasLocalPlayerAlive && !alive) {
      FeedbackHud.showElimination();
    }
    this.wasLocalPlayerAlive = alive;

    if (player) {
      localCharacterPredictor.setAlive(alive);
      localCharacterPredictor.setStrength(
        player.strengthFraction * settings.playerMaxStrength,
      );
      if (localCharacterPredictor.update(this.planets, deltaTimeInSeconds)) {
        player.head = localCharacterPredictor.head;
        player.leftFoot = localCharacterPredictor.leftFoot;
        player.rightFoot = localCharacterPredictor.rightFoot;
      }
      this.camera.follow(player.position, deltaTimeInSeconds);
    }
  }

  public render(renderer: Renderer, overlay: HTMLElement, shouldChangeLayout: boolean) {
    // First: everything below projects world coordinates through this frame's view area.
    this.camera.draw(renderer);
    this.objects.forEach((o) => {
      if (this.isVisible(o.id)) {
        o.render(renderer, overlay, shouldChangeLayout);
      }
    });
  }

  private isVisible(id: Id): boolean {
    const from = this.visibleFrom.get(id);
    return from === undefined || serverTimeline.renderTime >= from;
  }

  private stampPending(timestamp: number) {
    for (const id of this.awaitingCreateStamp) {
      this.visibleFrom.set(id, timestamp);
    }
    this.awaitingCreateStamp = [];

    for (const id of this.awaitingDeleteStamp) {
      this.deleteAt.set(id, timestamp);
    }
    this.awaitingDeleteStamp = [];
  }

  private retireDueObjects() {
    const renderTime = serverTimeline.renderTime;
    for (const [id, at] of [...this.deleteAt]) {
      if (renderTime >= at) {
        this.deleteObject(id);
      }
    }
  }

  private feedPredictor(updates: Array<UpdatePropertyCommand>) {
    const pose: Partial<Record<'head' | 'leftFoot' | 'rightFoot', Circle>> = {};
    for (const u of updates) {
      if (
        u.propertyKey === 'head' ||
        u.propertyKey === 'leftFoot' ||
        u.propertyKey === 'rightFoot'
      ) {
        pose[u.propertyKey] = u.propertyValue;
      }
    }
    if (pose.head && pose.leftFoot && pose.rightFoot) {
      localCharacterPredictor.setAuthoritative(pose.head, pose.leftFoot, pose.rightFoot);
    }
  }

  private addObject(object: View) {
    this.objects.set(object.id, object);
    if (object instanceof PlanetView) {
      this.planets.push(object);
    }
  }

  private deleteObject(id: Id) {
    this.objects.get(id)?.beforeDestroy?.();
    this.objects.delete(id);
    this.planets = this.planets.filter((p) => p.id !== id);
    this.visibleFrom.delete(id);
    this.deleteAt.delete(id);
  }
}
