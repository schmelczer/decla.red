import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  ProjectileBase,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdatePropertyCommand,
  GameObject,
  evaluateSdf,
  sumGravity,
} from 'shared';
import { BoundingBox } from '../physics/bounding-box';
import { CirclePhysical } from './circle-physical';
import { Physical } from '../physics/physical';
import { PhysicalContainer } from '../physics/physical-container';
import { CharacterPhysical } from './character-physical';
import { planetsIn } from './planet-physical';

export class ProjectilePhysical extends ProjectileBase implements Physical {
  public readonly canCollide = true;
  public readonly object: CirclePhysical;

  private isDestroyed = false;
  private bounceCount = 0;

  constructor(
    center: vec2,
    radius: number,
    public strength: number,
    team: CharacterTeam,
    velocity: vec2,
    public readonly originator: CharacterPhysical,
    private readonly container: PhysicalContainer,
    public readonly charge: number = 0,
  ) {
    super(id(), center, radius, team, strength);
    this.object = new CirclePhysical(this.center, radius, this, container, 0.9);
    vec2.copy(this.object.velocity, velocity);
    this.moveOutsideFriendlyBodies();
  }

  public get isAlive(): boolean {
    return !this.isDestroyed;
  }

  public get direction(): vec2 {
    const direction = vec2.clone(this.object.velocity);
    return vec2.length(direction) > 0
      ? vec2.normalize(direction, direction)
      : vec2.fromValues(0, -1);
  }

  public get boundingBox(): BoundingBox {
    return this.object.boundingBox;
  }

  public get gameObject(): this {
    return this;
  }

  public distance(target: vec2): number {
    return this.object.distance(target);
  }

  private moveOutsideFriendlyBodies() {
    const step = vec2.scale(vec2.create(), this.direction, 10);
    for (let pass = 0; pass < 32; pass++) {
      vec2.add(this.center, this.center, step);
      const friendly = this.container
        .findIntersecting(this.boundingBox)
        .filter((o) => o instanceof CharacterPhysical && o.team === this.team);
      if (evaluateSdf(this.center, friendly) >= this.radius) {
        return;
      }
    }
  }

  public destroy() {
    if (!this.isDestroyed) {
      this.isDestroyed = true;
      this.container.removeObject(this);
    }
  }

  public onCollision(other: GameObject) {
    if (other instanceof CharacterPhysical && other.team === this.team) {
      return;
    }
    this.bounceCount++;
    if (this.bounceCount > settings.projectileMaxBounceCount) {
      this.destroy();
    }
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdatePropertyCommand('center', this.center, this.object.velocity),
    ]);
  }

  public step(deltaTimeInSeconds: number) {
    super.step(deltaTimeInSeconds);

    if (this.strength <= 0) {
      this.destroy();
      return;
    }

    const intersecting = this.container.findIntersecting(
      BoundingBox.ofCircle(this.center, this.radius + settings.maxGravityDistance),
    );

    vec2.scaleAndAdd(
      this.object.velocity,
      this.object.velocity,
      sumGravity(planetsIn(intersecting), this.center),
      settings.projectileGravityScale * deltaTimeInSeconds,
    );

    this.object.stepManually(deltaTimeInSeconds, intersecting);
  }
}
