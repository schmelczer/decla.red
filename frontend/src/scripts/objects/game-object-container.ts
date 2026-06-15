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
import { StepCommand } from '../commands/types/step';
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

  protected commandExecutors: CommandExecutors = {
    [CreatePlayerCommand.type]: (c: CreatePlayerCommand) => {
      this.player = c.character as CharacterView;
      this.player.isMainCharacter = true;
      this.addObject(this.player);
      // Fresh character (first spawn or respawn at a far planet): drop any
      // prediction state so it snaps to the new body instead of gliding across.
      localCharacterPredictor.reset();
    },

    [CreateObjectsCommand.type]: (c: CreateObjectsCommand) =>
      c.objects.forEach((o) => this.addObject(o as GameObject)),

    [StepCommand.type]: (c: StepCommand) => {
      this.defaultCommandExecutor(c);

      if (this.player) {
        // Override the interpolated pose of the local player with the predicted
        // one so it responds to input immediately. Remote objects keep
        // interpolating. A large correction (respawn / death) snaps inside the
        // predictor rather than rubber-banding.
        localCharacterPredictor.setStrength(
          this.player.strengthFraction * settings.playerMaxStrength,
        );
        if (localCharacterPredictor.update(this.predictablePlanets(), c.deltaTimeInSeconds)) {
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
      c.updates.forEach((u) => {
        u.updates.forEach((au) => this.objects.get(u.id)?.handleCommand(au));
        if (this.player && u.id === this.player.id) {
          this.feedPredictor(u.updates);
        }
      });
    },

    [DeleteObjectsCommand.type]: (c: DeleteObjectsCommand) =>
      c.ids.forEach((id: Id) => this.deleteObject(id)),
  };

  constructor(private game: Game) {
    super();
  }

  // The local player's world position, but only while the body is alive. On
  // death the server deletes the character object (yet `player` keeps pointing
  // at the now-stale view), so gate on the object still being present — otherwise
  // the minimap would pin the "you" dot at the death spot for the whole respawn.
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
    this.objects.forEach((o) => o.handleCommand(c));
    this.camera.handleCommand(c);
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
  }
}
