import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  serializesTo,
  ProjectileBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  CommandExecutors,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { CharacterPhysical } from './character-physical';
import { moveCircle } from '../physics/functions/move-circle';
import { StepCommand } from '../commands/step';
import { ReactToCollisionCommand } from '../commands/react-to-collision';

@serializesTo(ProjectileBase)
export class ProjectilePhysical extends ProjectileBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;

  private isDestroyed = false;
  private bounceCount = 0;
  private _boundingBox?: ImmutableBoundingBox;

  public object: CirclePhysical;

  protected commandExecutors: CommandExecutors = {
    [StepCommand.type]: this.handleStep.bind(this),
    [ReactToCollisionCommand.type]: this.onCollision.bind(this),
  };

  constructor(
    center: vec2,
    radius: number,
    public strength: number,
    team: CharacterTeam,
    private velocity: vec2,
    public readonly originator: CharacterPhysical,
    readonly container: PhysicalContainer,
  ) {
    super(id(), center, radius, team, strength);
    this.object = new CirclePhysical(center, radius, this, container, 0.9);

    this.moveOutsideOfObject();
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  private moveOutsideOfObject() {
    let wasCollision = true;
    const delta = vec2.scale(
      vec2.create(),
      vec2.normalize(vec2.create(), this.velocity),
      10,
    );
    while (wasCollision) {
      const intersecting = this.container
        .findIntersecting(this.boundingBox)
        .filter((g) => g instanceof CharacterPhysical && g.team === this.team);
      const { hitSurface } = moveCircle(this.object, delta, intersecting, true);
      wasCollision = hitSurface;
    }
    vec2.add(this.center, this.center, delta);
    vec2.add(this.center, this.center, delta);
  }

  public get boundingBox(): ImmutableBoundingBox {
    if (!this._boundingBox) {
      this._boundingBox = (this.object as CirclePhysical).boundingBox;
    }

    return this._boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public distance(target: vec2): number {
    return this.object.distance(target);
  }

  public destroy() {
    if (!this.isDestroyed) {
      this.isDestroyed = true;
      this.container.removeObject(this);
    }
  }

  public onCollision({ other }: ReactToCollisionCommand) {
    if (
      !(other instanceof CharacterPhysical && other.team === this.team) &&
      this.bounceCount++ === settings.projectileMaxBounceCount
    ) {
      this.destroy();
    }
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('center', this.center, this.velocity),
    ]);
  }

  private handleStep({ deltaTimeInSeconds }: StepCommand) {
    super.step(deltaTimeInSeconds);

    if (this.strength <= 0) {
      this.destroy();
      return;
    }

    vec2.copy(this.object.velocity, this.velocity);
    const { velocity } = this.object.stepManually(deltaTimeInSeconds);
    vec2.copy(this.velocity, velocity);
  }
}
