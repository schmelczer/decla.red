import { vec2 } from 'gl-matrix';
import {
  Circle,
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
  settings,
  UpdatePropertyCommand,
} from 'shared';
import { BeforeDestroyCommand } from '../commands/types/before-destroy';
import { RenderCommand } from '../commands/types/render';
import { StepCommand } from '../commands/types/step';
import { FeedbackHud } from '../feedback-hud';
import { Game } from '../game';
import { serverTimeline } from '../helper/server-timeline';
import { PredictablePlanet } from '../helper/prediction/client-character-world';
import { localCharacterPredictor } from '../helper/prediction/local-character-predictor';
import { Camera } from './types/camera';
import { CharacterView } from './types/character-view';
import { PlanetView } from './types/planet-view';

export class GameObjectContainer extends CommandReceiver {
  protected objects: Map<Id, GameObject> = new Map();
  public player!: CharacterView;
  public camera: Camera = new Camera(this.game);
  private wasLocalPlayerAlive = false;

  // Create and delete arrive on the wire, but positions are drawn
  // interpolationDelaySeconds in the past — so applying them the instant a
  // packet lands made every projectile pop into existence and hang at its muzzle
  // for 100 ms, then disappear a few hundred units before its rendered impact.
  // Objects are therefore admitted and retired on the render timeline instead:
  // they exist (and accumulate interpolation frames) from the moment they
  // arrive, but only draw once the cursor reaches the snapshot that introduced
  // them, and keep drawing until it reaches the one that removed them.
  private visibleFrom = new Map<Id, number>();
  private deleteAt = new Map<Id, number>();
  private awaitingCreateStamp: Array<Id> = [];
  private awaitingDeleteStamp: Array<Id> = [];

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.player.isMainCharacter = true;
      this.addObject(this.player);
      // Fresh character (first spawn or respawn at a far planet): drop any
      // prediction state so it snaps to the new body instead of gliding across.
      localCharacterPredictor.reset();
      // Respawned — clear the elimination overlay.
      FeedbackHud.hideElimination();
      this.wasLocalPlayerAlive = true;
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => {
        this.addObject(o as GameObject);
        this.awaitingCreateStamp.push((o as GameObject).id);
      }),

    [StepCommand.type]: (c: StepCommand) => {
      // A batch carrying no property updates (a bare announcement, say) leaves
      // entries unstamped; fall back to the newest known snapshot so nothing is
      // stranded invisible.
      this.stampPending(serverTimeline.snapshotTime);
      this.retireDueObjects();
      this.defaultCommandExecutor(c);

      // The local body is alive only while its object still exists (the server
      // deletes it on death) and its health is above zero — `player` keeps
      // pointing at the now-stale view after death, so both checks are needed.
      const bodyPresent = !!this.player && this.objects.has(this.player.id);
      const alive = bodyPresent && this.player.health > 0;

      // Show the elimination overlay on the alive→dead edge; CreatePlayerCommand
      // clears it on respawn.
      if (this.wasLocalPlayerAlive && !alive) {
        FeedbackHud.showElimination();
      }
      this.wasLocalPlayerAlive = alive;

      if (bodyPresent) {
        // Override the interpolated pose of the local player with the predicted
        // one so it responds to input immediately. Suppressed while dead so the
        // corpse can't be walked around (the server ignores a dead player's
        // input — a moving predicted body would be a pure client-side desync).
        // A large correction (respawn / death) snaps inside the predictor.
        localCharacterPredictor.setAlive(alive);
        localCharacterPredictor.setStrength(
          this.player.strengthFraction * settings.playerMaxStrength,
        );
        if (
          localCharacterPredictor.update(this.predictablePlanets(), c.deltaTimeInSeconds)
        ) {
          this.player.head = localCharacterPredictor.head;
          this.player.leftFoot = localCharacterPredictor.leftFoot;
          this.player.rightFoot = localCharacterPredictor.rightFoot;
        }
        this.camera.follow(this.player.position, c.deltaTimeInSeconds);
      }
    },

    [RemoteCallsForObjects.type]: (c: RemoteCallsForObjects) =>
      c.callsForObjects.forEach((c) =>
        this.objects.get(c.id)?.processRemoteCalls(c.calls),
      ),

    [PropertyUpdatesForObjects.type]: (c: PropertyUpdatesForObjects) => {
      serverTimeline.onSnapshot(c.timestamp);
      // Create/delete precede the property updates inside a batch, so this is
      // where the batch's server timestamp becomes known to them.
      this.stampPending(c.timestamp);
      c.updates.forEach((u) => {
        u.updates.forEach((au) => this.objects.get(u.id)?.handleCommand(au));
        if (this.player && u.id === this.player.id) {
          this.feedPredictor(u.updates);
        }
      });
    },

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.awaitingDeleteStamp.push(id)),
  };

  constructor(private game: Game) {
    super();
  }

  /**
   * Forget everything the previous connection was told about.
   *
   * A reconnect is a brand-new server-side player whose view-area bookkeeping
   * starts empty, so it re-announces what is in view NOW and never sends a
   * delete for anything the dropped session held. Without this, every object
   * that has since moved out of view — the old character included — stays in the
   * map and on screen forever, as a frozen ghost.
   *
   * `player` is deliberately left pointing at the stale view: every read of it
   * is gated on the object still being in `objects`, so clearing the map is what
   * makes it inert, and the next CreatePlayerCommand replaces it.
   */
  public reset() {
    this.objects.forEach((o) => o.handleCommand(new BeforeDestroyCommand()));
    this.objects.clear();
    this.visibleFrom.clear();
    this.deleteAt.clear();
    this.awaitingCreateStamp = [];
    this.awaitingDeleteStamp = [];
    this.wasLocalPlayerAlive = false;
  }

  public get localPlayerPosition(): vec2 | undefined {
    return this.player && this.objects.has(this.player.id)
      ? this.player.position
      : undefined;
  }

  public get planets(): Array<PlanetView> {
    const planets: Array<PlanetView> = [];
    this.objects.forEach((o) => {
      if (o instanceof PlanetView) {
        planets.push(o);
      }
    });
    return planets;
  }

  protected defaultCommandExecutor(c: Command) {
    const isRender = c.type === RenderCommand.type;
    this.objects.forEach((o) => {
      // Stepping always runs, so an object that has not appeared yet is still
      // accumulating interpolation frames and enters the scene already moving.
      if (isRender && !this.isVisible(o.id)) {
        return;
      }
      o.handleCommand(c);
    });
    this.camera.handleCommand(c);
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
    if (this.deleteAt.size === 0) {
      return;
    }
    const renderTime = serverTimeline.renderTime;
    for (const [id, at] of [...this.deleteAt]) {
      if (renderTime >= at) {
        this.deleteAt.delete(id);
        this.deleteObject(id);
      }
    }
  }

  // Hand the local player's raw authoritative pose to the predictor (the
  // interpolated pose would already be ~100 ms stale). The three body parts
  // arrive together in one snapshot.
  private feedPredictor(updates: Array<UpdatePropertyCommand>) {
    let head: Circle | undefined;
    let leftFoot: Circle | undefined;
    let rightFoot: Circle | undefined;
    for (const u of updates) {
      if (u.propertyKey === 'head') head = u.propertyValue as Circle;
      else if (u.propertyKey === 'leftFoot') leftFoot = u.propertyValue as Circle;
      else if (u.propertyKey === 'rightFoot') rightFoot = u.propertyValue as Circle;
    }
    if (head && leftFoot && rightFoot) {
      localCharacterPredictor.setAuthoritative(head, leftFoot, rightFoot);
    }
  }

  private predictablePlanets(): Array<PredictablePlanet> {
    return this.planets.map((p) => ({
      id: p.id,
      vertices: p.vertices,
      center: p.center,
      radius: p.radius,
      rotation: p.predictionRotation,
      rotationSpeed: p.predictionRotationSpeed,
    }));
  }

  private addObject(object: GameObject) {
    this.objects.set(object.id, object);
  }

  private deleteObject(id: Id) {
    const object = this.objects.get(id);
    object?.handleCommand(new BeforeDestroyCommand());
    this.objects.delete(id);
    this.visibleFrom.delete(id);
    this.deleteAt.delete(id);
  }
}
