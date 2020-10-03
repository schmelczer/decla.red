import { vec2 } from 'gl-matrix';
import { InvertedTunnel } from 'sdf-2d';
import { RenderCommand } from '../../commands/render';
import { BoundingBoxBase } from '../../physics/bounds/bounding-box-base';
import { ImmutableBoundingBox } from '../../physics/bounds/immutable-bounding-box';
import { Physics } from '../../physics/physics';
import { StaticPhysicalObject } from '../../physics/static-physical-object';

export class Tunnel extends StaticPhysicalObject {
  public readonly isInverted = true;
  private shape: InvertedTunnel;

  constructor(
    physics: Physics,
    from: vec2,
    to: vec2,
    fromRadius: number,
    toRadius: number
  ) {
    super(physics, true);
    this.shape = new InvertedTunnel(from, to, fromRadius, toRadius);
    this.addToPhysics();

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  public distance(target: vec2): number {
    return this.shape.minDistance(target);
  }

  public getBoundingBox(): BoundingBoxBase {
    const xMin = Math.min(
      this.shape.from.x - this.shape.fromRadius,
      this.shape.to.x - this.shape.toRadius
    );
    const yMin = Math.min(
      this.shape.from.y - this.shape.fromRadius,
      this.shape.to.y - this.shape.toRadius
    );
    const xMax = Math.max(
      this.shape.from.x + this.shape.fromRadius,
      this.shape.to.x + this.shape.toRadius
    );
    const yMax = Math.max(
      this.shape.from.y + this.shape.fromRadius,
      this.shape.to.y + this.shape.toRadius
    );
    return new ImmutableBoundingBox(this, xMin, xMax, yMin, yMax, true);
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.shape);
  }
}
