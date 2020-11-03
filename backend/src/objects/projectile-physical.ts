import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  serializesTo,
  ProjectileBase,
  GameObject,
  CharacterTeam,
  PropertyUpdatesForObject,
  UpdateProperty,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlanetPhysical } from './planet-physical';
import { ReactsToCollision } from '../physics/physicals/reacts-to-collision';
import { PlayerCharacterPhysical } from './player-character-physical';
import { moveCircle } from '../physics/functions/move-circle';

@serializesTo(ProjectileBase)
export class ProjectilePhysical
  extends ProjectileBase
  implements DynamicPhysical, ReactsToCollision {
  public readonly canCollide = true;
  public readonly canMove = true;

  private isDestroyed = false;
  private bounceCount = 0;
  private _boundingBox?: ImmutableBoundingBox;

  public object: CirclePhysical;

  constructor(
    center: vec2,
    radius: number,
    public strength: number,
    team: CharacterTeam,
    private velocity: vec2,
    public readonly originator: PlayerCharacterPhysical,
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
        .filter((g) => g instanceof PlayerCharacterPhysical && g.team === this.team);
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

  public onCollision(other: GameObject) {
    if (
      !(other instanceof PlayerCharacterPhysical && other.team === this.team) &&
      this.bounceCount++ === settings.projectileMaxBounceCount
    ) {
      this.destroy();
    }
  }

  public getPropertyUpdates(): PropertyUpdatesForObject {
    return new PropertyUpdatesForObject(this.id, [
      new UpdateProperty('center', this.center, this.velocity),
    ]);
  }

  public step(deltaTime: number) {
    super.step(deltaTime);

    if (this.strength <= 0) {
      this.destroy();
      return;
    }

    const gravity = vec2.create();
    const intersecting = this.container.findIntersecting(this.boundingBox);
    intersecting.forEach((i) => {
      if (i instanceof PlanetPhysical) {
        vec2.add(gravity, gravity, i.getForce(this.center));
      }
    });

    vec2.add(
      this.velocity,
      this.velocity,
      vec2.scale(
        vec2.create(),
        gravity,
        deltaTime * settings.gravityScalingForProjectiles,
      ),
    );

    vec2.copy(this.object.velocity, this.velocity);
    const { velocity } = this.object.step2(deltaTime);
    vec2.copy(this.velocity, velocity);
  }
}
