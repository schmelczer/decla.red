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
  Circle,
  marchCircle,
} from 'shared';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { CirclePhysical } from './circle-physical';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { CharacterPhysical } from './character-physical';
import { forceAtPosition } from '../physics/functions/force-at-position';
import { getBoundingBoxOfCircle } from '../physics/functions/get-bounding-box-of-circle';
import { StepCommand, ReactToCollisionCommand } from '../commands/commands';

@serializesTo(ProjectileBase)
export class ProjectilePhysical extends ProjectileBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;

  private isDestroyed = false;
  private bounceCount = 0;

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
    // Normalised charge (0..1) of the shot that fired this; the victim scales
    // hit/kill feedback and the death fling by it.
    public readonly charge: number = 0,
  ) {
    super(id(), center, radius, team, strength);
    this.object = new CirclePhysical(center, radius, this, container, 0.9);

    this.moveOutsideOfObject();
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  public get direction(): vec2 {
    const direction = vec2.clone(this.velocity);
    return vec2.length(direction) > 0
      ? vec2.normalize(direction, direction)
      : vec2.fromValues(0, -1);
  }

  private moveOutsideOfObject() {
    let wasCollision = true;
    const delta = vec2.scale(
      vec2.create(),
      vec2.normalize(vec2.create(), this.velocity),
      10,
    );
    // Bounded: each pass advances by `delta`, but a degenerate direction would
    // otherwise spin here forever inside the physics tick.
    let passes = 0;
    while (wasCollision && passes++ < 32) {
      const intersecting = this.container
        .findIntersecting(this.boundingBox)
        .filter((g) => g instanceof CharacterPhysical && g.team === this.team);
      const { hitSurface } = marchCircle(this.object, delta, intersecting, true);
      wasCollision = hitSurface;
      this.object.syncBoundingBox();
    }
  }

  // Live view of the circle's box, not a snapshot — the circle keeps it in sync
  // as it moves.
  public get boundingBox(): BoundingBoxBase {
    return this.object.boundingBox;
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
    this.advance(deltaTimeInSeconds);
  }

  private advance(deltaTimeInSeconds: number) {
    super.step(deltaTimeInSeconds);

    if (this.strength <= 0) {
      this.destroy();
      return;
    }

    // This single broadphase is reused for the step below: the gravity radius
    // (maxGravityDistance) dwarfs one tick's travel, so the set is a superset of
    // the swept-collision box and the step needn't query the container again.
    const intersecting = this.container.findIntersecting(
      getBoundingBoxOfCircle(
        new Circle(this.center, this.object.radius + settings.maxGravityDistance),
      ),
    );

    vec2.scaleAndAdd(
      this.velocity,
      this.velocity,
      forceAtPosition(this.center, intersecting),
      settings.projectileGravityScale * deltaTimeInSeconds,
    );

    vec2.copy(this.object.velocity, this.velocity);
    const { velocity } = this.object.stepManually(deltaTimeInSeconds, intersecting);
    vec2.copy(this.velocity, velocity);
  }
}
