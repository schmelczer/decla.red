import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import { MoveToCommand } from '../../commands/move-to';
import { RenderCommand } from '../../commands/render';
import { BoundingBoxBase } from '../../physics/bounds/bounding-box-base';
import { ImmutableBoundingBox } from '../../physics/bounds/immutable-bounding-box';
import { PhysicalObject } from '../../physics/physical-object';
import { Physics } from '../../physics/physics';
import { settings } from '../../settings';

export class Lamp extends PhysicalObject {
  private light: CircleLight;

  constructor(center: vec2, color: vec3, lightness: number, physics: Physics) {
    super(physics, false);

    this.light = new CircleLight(center, color, lightness);
    this.addToPhysics();

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  public distance(target: vec2): number {
    return this.light.minDistance(target);
  }

  public getBoundingBox(): BoundingBoxBase {
    return new ImmutableBoundingBox(
      this,
      this.light.center.x - settings.lightCutoffDistance,
      this.light.center.x + settings.lightCutoffDistance,
      this.light.center.y - settings.lightCutoffDistance,
      this.light.center.y + settings.lightCutoffDistance
    );
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.light);
  }

  private moveTo(c: MoveToCommand) {
    this.light.center = c.position;
  }
}
