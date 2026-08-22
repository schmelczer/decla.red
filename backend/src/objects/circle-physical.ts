import { vec2 } from 'gl-matrix';
import {
  Circle,
  CommandExecutors,
  CommandReceiver,
  GameObject,
  resolveCircleMovement,
  serializesTo,
} from 'shared';
import { BoundingBox } from '../physics/bounding-boxes/bounding-box';
import { BoundingBoxBase } from '../physics/bounding-boxes/bounding-box-base';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { Physical } from '../physics/physicals/physical';
import { ReactToCollisionCommand } from '../commands/react-to-collision';

@serializesTo(Circle)
export class CirclePhysical extends CommandReceiver implements Circle, DynamicPhysical {
  readonly canCollide = true;
  readonly canMove = true;

  public velocity = vec2.create();
  public lastNormal = vec2.fromValues(0, 1);

  private _boundingBox: BoundingBox;

  protected commandExecutors: CommandExecutors = {
    [ReactToCollisionCommand.type]: this.onCollision.bind(this),
  };

  constructor(
    private _center: vec2,
    private _radius: number,
    public owner: GameObject,
    private readonly container: PhysicalContainer,
    // Public + readonly so a CirclePhysical structurally satisfies the shared
    // PhysicsBody interface the movement simulation operates on.
    public readonly restitution = 0,
  ) {
    super();
    this._boundingBox = new BoundingBox();
    this.syncBoundingBox();
  }

  public get boundingBox(): BoundingBoxBase {
    return this._boundingBox;
  }

  public get center(): vec2 {
    return this._center;
  }

  public set center(value: vec2) {
    this._center = value;
    this.syncBoundingBox();
  }

  public onCollision(c: ReactToCollisionCommand) {
    this.owner.handleCommand(c);
  }

  public get gameObject(): GameObject {
    return this.owner;
  }

  public get radius(): number {
    return this._radius;
  }

  public set radius(value: number) {
    this._radius = value;
    this.syncBoundingBox();
  }

  public distance(target: vec2): number {
    return vec2.distance(target, this.center) - this.radius;
  }

  public syncBoundingBox() {
    this._boundingBox.xMin = this.center.x - this._radius;
    this._boundingBox.xMax = this.center.x + this._radius;
    this._boundingBox.yMin = this.center.y - this._radius;
    this._boundingBox.yMax = this.center.y + this._radius;
  }

  public applyForce(force: vec2, timeInSeconds: number) {
    vec2.add(
      this.velocity,
      this.velocity,
      vec2.scale(vec2.create(), force, timeInSeconds),
    );
  }

  // Position-resolution for one tick. Delegates to the shared
  // resolveCircleMovement so the server integrates a body with the exact same
  // geometry the client predictor runs (shared/physics) — no parallel copy to
  // keep in sync. The onHit callback dispatches the collision reactions at the
  // same points the old inline move-circle did (both the initial march and the
  // post-bounce slide). `possibleIntersectors`, when supplied, lets a caller
  // that already broadphased (e.g. a projectile's gravity query) avoid a second
  // container query; otherwise it is self-gathered from the swept bounding box.
  public stepManually(
    deltaTimeInSeconds: number,
    possibleIntersectors?: Array<Physical>,
  ): {
    hitObject: GameObject | undefined;
    velocity: vec2;
  } {
    const intersecting = (
      possibleIntersectors ?? this.sweptBroadphase(deltaTimeInSeconds)
    ).filter((b) => b.gameObject !== this.gameObject && b.canCollide);

    const { hitObject, velocity } = resolveCircleMovement(
      this,
      deltaTimeInSeconds,
      intersecting,
      (intersected) => {
        const physical = intersected as Physical;
        physical.handleCommand(new ReactToCollisionCommand(this.gameObject));
        this.handleCommand(new ReactToCollisionCommand(physical.gameObject));
      },
    );

    // The body has moved; re-register it where it actually is.
    this.syncBoundingBox();

    return { hitObject: (hitObject as Physical | undefined)?.gameObject, velocity };
  }

  // Query the container with the bounding box grown by this tick's travel, so a
  // fast-moving body still sees what it is about to sweep into.
  private sweptBroadphase(deltaTimeInSeconds: number): Array<Physical> {
    const sweep = vec2.length(
      vec2.scale(vec2.create(), this.velocity, deltaTimeInSeconds),
    );
    this.radius += sweep;
    const intersecting = this.container.findIntersecting(this.boundingBox);
    this.radius -= sweep;
    return intersecting;
  }

  public toArray(): Array<any> {
    const { center, radius } = this;
    return [center, radius];
  }
}
