import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  serializesTo,
  ProjectileBase,
  GameObject,
  CharacterTeam,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { DynamicPhysical } from '../physics/physicals/dynamic-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';
import { PlanetPhysical } from './planet-physical';
import { ReactsToCollision } from '../physics/physicals/reacts-to-collision';
import { UpdateObjectMessage } from 'shared/lib/src/objects/update-object-message';
import { UpdateGameObjectMessage } from '../update-game-object-message';
import { PlayerCharacterPhysical } from './player-character-physical';

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
    colorIndex: number,
    public strength: number,
    public team: CharacterTeam,
    private velocity: vec2,
    readonly container: PhysicalContainer,
  ) {
    super(id(), center, radius, colorIndex, strength);
    this.object = new CirclePhysical(center, radius, this, container, 0.9);
  }

  public calculateUpdates(): UpdateObjectMessage {
    return new UpdateGameObjectMessage(this, ['center', 'strength']);
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

  public step(deltaTime: number) {
    if ((this.strength -= settings.projectileFadeSpeed * deltaTime) < 0) {
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

    vec2.add(this.velocity, this.velocity, vec2.scale(vec2.create(), gravity, deltaTime));

    this.object.velocity = this.velocity;
    this.object.step2(deltaTime);
  }
}
