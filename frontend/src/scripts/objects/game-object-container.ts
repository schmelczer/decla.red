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

  // Create/delete are admitted/retired on the render timeline (not the wire) so interpolated objects don't pop at the muzzle.
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
        this.addObject(o as GameObject);
        this.awaitingCreateStamp.push((o as GameObject).id);
      }),

    [StepCommand.type]: (c: StepCommand) => {
      // Fall back to newest snapshot if a batch had no property updates, so nothing is stranded.
      this.stampPending(serverTimeline.snapshotTime);
      this.retireDueObjects();
      this.defaultCommandExecutor(c);

      // Alive = object exists AND health > 0 (player pointer outlives the body).
      const bodyPresent = !!this.player && this.objects.has(this.player.id);
      const alive = bodyPresent && this.player.health > 0;

      if (this.wasLocalPlayerAlive && !alive) {
        FeedbackHud.showElimination();
      }
      this.wasLocalPlayerAlive = alive;

      if (bodyPresent) {
        // Override the local player's interpolated pose with the predicted one; suppressed while dead (server ignores dead input).
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
      // Create/delete precede property updates in a batch — timestamp is known here.
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
   * A reconnect is a new server-side player that never sends deletes for the
   * old session's objects — clear them or they stay as frozen ghosts. `player`
   * is left stale: reads are gated on `objects`, and the next CreatePlayerCommand
   * replaces it.
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
      // Stepping runs even for not-yet-visible objects so they enter the scene already moving.
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

  // Feed the predictor the raw (not interpolated) authoritative pose.
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
