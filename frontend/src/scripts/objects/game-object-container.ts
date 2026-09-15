import { Renderer } from 'sdf-2d';
import {
  Circle,
  CharacterBase,
  CommandExecutors,
  CommandReceiver,
  CreateObjectsCommand,
  CreatePlayerCommand,
  DeleteObjectsCommand,
  Id,
  PropertyUpdatesForObjects,
  RemoteCall,
  RemoteCallsForObjects,
  UpdatePropertyCommand,
} from 'shared';
import { FeedbackHud } from '../feedback-hud';
import type { Game } from '../game';
import { serverTimeline } from '../helper/server-timeline';
import { localCharacterPredictor } from '../helper/prediction/local-character-predictor';
import { Camera } from './types/camera';
import { CharacterView } from './types/character-view';
import { PlanetView } from './types/planet-view';
import { View } from './view';

// Keep enough history for interpolation, without retaining a background tab's entire session.
const deferredHistorySeconds = 0.5;
const persistentRemoteCalls = new Set(['setKillCount', 'setLight', 'setContested']);

export class GameObjectContainer extends CommandReceiver {
  public player?: CharacterView;
  public readonly camera: Camera;
  public planets: Array<PlanetView> = [];

  private objects: Map<Id, View> = new Map();
  private wasLocalPlayerAlive = false;
  private lastStepAtMs = performance.now();

  // Creates and deletes take effect on the render timeline, not on arrival.
  private visibleFrom = new Map<Id, number>();
  private deleteAt = new Map<Id, number>();
  private awaitingCreateStamp: Array<Id> = [];
  private awaitingDeleteStamp: Array<Id> = [];
  private remoteCalls: Array<{ object: View; calls: Array<RemoteCall>; at?: number }> =
    [];

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.name]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.player.isMainCharacter = true;
      this.addObject(this.player);
      localCharacterPredictor.reset();
      this.game.resendMovement();
      this.wasLocalPlayerAlive = true;
    },

    [CreateObjectsCommand.name]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => {
        this.addObject(o as View);
        this.awaitingCreateStamp.push(o.id);
      }),

    [RemoteCallsForObjects.name]: (c: RemoteCallsForObjects) =>
      c.callsForObjects.forEach(({ id, calls }) => {
        const object = this.objects.get(id);
        if (object === this.player) {
          object?.processRemoteCalls(calls);
        } else if (object) {
          this.remoteCalls.push({ object, calls });
        }
      }),

    [PropertyUpdatesForObjects.name]: (c: PropertyUpdatesForObjects) => {
      serverTimeline.onSnapshot(c.timestamp);
      this.stampPending(c.timestamp);
      this.pruneDeferred(c.timestamp - deferredHistorySeconds);
      c.updates.forEach((u) => {
        const object = this.objects.get(u.id);
        u.updates.forEach((au) => object?.updateProperty?.(au));
        if (object && object === this.player) {
          this.feedPredictor(u.updates);
        }
      });
    },

    [DeleteObjectsCommand.name]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.awaitingDeleteStamp.push(id)),
  };

  constructor(private readonly game: Game) {
    super();
    this.camera = new Camera(game);
  }

  public reset() {
    this.objects.forEach((o) => o.beforeDestroy?.());
    this.objects.clear();
    this.player = undefined;
    this.planets = [];
    this.visibleFrom.clear();
    this.deleteAt.clear();
    this.awaitingCreateStamp = [];
    this.awaitingDeleteStamp = [];
    this.remoteCalls = [];
    this.wasLocalPlayerAlive = false;
    this.lastStepAtMs = performance.now();
  }

  public get localPlayer(): CharacterView | undefined {
    return this.player && this.objects.has(this.player.id) ? this.player : undefined;
  }

  public step(deltaTimeInSeconds: number) {
    this.stampPending(serverTimeline.snapshotTime);
    const nowMs = performance.now();
    const resumed = nowMs - this.lastStepAtMs > deferredHistorySeconds * 1000;
    this.lastStepAtMs = nowMs;
    this.pruneDeferred(
      serverTimeline.renderTime - (resumed ? 0 : deferredHistorySeconds),
    );
    this.retireDueObjects();
    this.remoteCalls = this.remoteCalls.filter(({ object, calls, at }) => {
      if (this.objects.get(object.id) !== object) {
        return false;
      }
      if (at !== undefined && at <= serverTimeline.renderTime) {
        object.processRemoteCalls(calls);
        return false;
      }
      return true;
    });
    this.objects.forEach((o) => o.step(deltaTimeInSeconds));

    const player = this.localPlayer;
    const alive = !!player && player.health > 0;
    this.wasLocalPlayerAlive = alive;

    if (player) {
      localCharacterPredictor.setAlive(alive);
      localCharacterPredictor.setStrength(player.snapshotStrength);
      if (localCharacterPredictor.update(this.planets)) {
        player.head = localCharacterPredictor.head;
        player.leftFoot = localCharacterPredictor.leftFoot;
        player.rightFoot = localCharacterPredictor.rightFoot;
      }
      this.camera.follow(player.position);
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
    for (const call of this.remoteCalls) {
      call.at ??= timestamp;
    }
  }

  private pruneDeferred(cutoff: number) {
    this.retireDueObjects(cutoff);
    this.remoteCalls = this.remoteCalls.filter(({ object, calls, at }) => {
      if (at === undefined || at > cutoff) {
        return true;
      }
      for (const call of calls) {
        if (call.functionName === 'setHealth' && object instanceof CharacterBase) {
          // The view's health setter also plays hit feedback; expired damage is state only.
          object.health = call.args[0];
        } else if (persistentRemoteCalls.has(call.functionName)) {
          object.processRemoteCalls([call]);
        }
      }
      return false;
    });
  }

  private retireDueObjects(renderTime = serverTimeline.renderTime) {
    for (const [id, at] of this.deleteAt) {
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
    // An object can re-enter the interest area before its delayed deletion is drawn.
    // Retire the old view and its pending deletion before installing the replacement.
    if (this.objects.has(object.id)) {
      this.deleteObject(object.id);
    }
    this.awaitingDeleteStamp = this.awaitingDeleteStamp.filter((id) => id !== object.id);
    this.objects.set(object.id, object);
    if (object instanceof PlanetView) {
      this.planets.push(object);
    }
  }

  private deleteObject(id: Id) {
    const object = this.objects.get(id);
    object?.beforeDestroy?.();
    this.objects.delete(id);
    this.remoteCalls = this.remoteCalls.filter((call) => call.object !== object);
    if (this.player === object) {
      this.player = undefined;
    }
    this.planets = this.planets.filter((p) => p.id !== id);
    this.visibleFrom.delete(id);
    this.deleteAt.delete(id);
  }
}
