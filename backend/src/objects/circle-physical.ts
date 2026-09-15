import { vec2 } from 'gl-matrix';
import { Circle, GameObject, resolveCircleMovement } from 'shared';
import { BoundingBox } from '../physics/bounding-box';
import { PhysicalContainer } from '../physics/physical-container';
import { Physical } from '../physics/physical';

export class CirclePhysical extends Circle implements Physical {
  public readonly canCollide = true;
  public velocity = vec2.create();
  public lastNormal = vec2.fromValues(0, 1);

  private readonly box = new BoundingBox();

  constructor(
    center: vec2,
    radius: number,
    public readonly owner: Physical,
    private readonly container: PhysicalContainer,
    public readonly restitution = 0,
  ) {
    super(center, radius);
  }

  public get boundingBox(): BoundingBox {
    return this.box.setCircle(this.center, this.radius);
  }

  public get gameObject(): GameObject {
    return this.owner.gameObject;
  }

  public onCollision(other: GameObject) {
    this.owner.onCollision?.(other);
  }

  public stepManually(
    deltaTimeInSeconds: number,
    possibleIntersectors?: Array<Physical>,
  ): GameObject | undefined {
    const intersecting = (
      possibleIntersectors ?? this.sweptBroadphase(deltaTimeInSeconds)
    ).filter((b) => b.gameObject !== this.gameObject && b.canCollide);

    const hit = resolveCircleMovement(
      this,
      deltaTimeInSeconds,
      intersecting,
      (intersected) => {
        const physical = intersected as Physical;
        physical.onCollision?.(this.gameObject);
        this.onCollision(physical.gameObject);
      },
    ) as Physical | undefined;

    return hit?.gameObject;
  }

  private sweptBroadphase(deltaTimeInSeconds: number): Array<Physical> {
    const sweep = vec2.length(this.velocity) * deltaTimeInSeconds;
    return this.container.findIntersecting(
      BoundingBox.ofCircle(this.center, this.radius + sweep),
    );
  }
}
