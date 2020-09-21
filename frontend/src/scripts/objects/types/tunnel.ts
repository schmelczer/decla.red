import { vec2 } from 'gl-matrix';
import { RenderCommand } from '../../graphics/commands/render';
import { Physics } from '../../physics/physics';
import { TunnelShape } from '../../shapes/types/tunnel-shape';
import { GameObject } from '../game-object';

export class Tunnel extends GameObject {
  private shape: TunnelShape;

  constructor(
    physics: Physics,
    public readonly from: vec2,
    to: vec2,
    fromRadius: number,
    toRadius: number
  ) {
    super();

    this.shape = new TunnelShape(from, to, fromRadius, toRadius, this);
    physics.addStaticBoundingBox(this.shape.boundingBox);
    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.shape);
  }
}
