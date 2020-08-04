import { vec2 } from 'gl-matrix';
import { GameObject } from '../game-object';
import { RenderCommand } from '../../drawing/commands/render';
import { Physics } from '../../physics/physics';
import { TunnelShape } from '../../drawing/drawables/primitives/tunnel-shape';

export interface Line {}

export class Tunnel extends GameObject {
  private primitive: TunnelShape;

  constructor(
    physics: Physics,
    public readonly from: vec2,
    to: vec2,
    fromRadius: number,
    toRadius: number
  ) {
    super();

    this.primitive = new TunnelShape(this, from, to, fromRadius, toRadius);
    physics.addStaticBoundingBox(this.primitive.boundingBox);
    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.drawPrimitive(this.primitive);
  }
}
