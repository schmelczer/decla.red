import { vec2 } from 'gl-matrix';
import {
  id,
  settings,
  serializesTo,
  ProjectileBase,
  GameObject,
  rotate90Deg,
} from 'shared';
import { ImmutableBoundingBox } from '../physics/bounding-boxes/immutable-bounding-box';
import { CirclePhysical } from './circle-physical';
import { DynamicPhysical } from '../physics/conatiners/dynamic-physical';
import { PhysicalContainer } from '../physics/containers/physical-container';

@serializesTo(ProjectileBase)
export class ProjectilePhysical extends ProjectileBase implements DynamicPhysical {
  public readonly canCollide = true;
  public readonly canMove = true;

  public object: CirclePhysical;

  constructor(
    center: vec2,
    radius: number,
    private velocity: vec2,
    readonly container: PhysicalContainer,
  ) {
    super(id(), center, radius);
    this.object = new CirclePhysical(center, radius, this, container, 0.9);
  }

  private _boundingBox?: ImmutableBoundingBox;

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

  public onCollision(normal: vec2, other: GameObject) {
    const tangent = rotate90Deg(normal);
    vec2.scale(this.velocity, tangent, vec2.dot(tangent, this.velocity));
  }

  public step(deltaTimeInMiliseconds: number) {
    const deltaTime = deltaTimeInMiliseconds / 1000;

    vec2.add(
      this.velocity,
      this.velocity,
      vec2.scale(vec2.create(), settings.gravitationalForce, deltaTime),
    );

    this.object.velocity = this.velocity;
    this.object.step2(deltaTime);
  }
}
