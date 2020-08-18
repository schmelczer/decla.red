import { vec2 } from 'gl-matrix';
import { GameObject } from '../game-object';
import { RenderCommand } from '../../drawing/commands/render';
import { Physics } from '../../physics/physics';
import { TunnelShape } from '../../shapes/types/tunnel-shape';
import { DrawableTunnel } from '../../drawing/drawables/drawable-tunnel';

export class Tunnel extends GameObject {
  private shape: DrawableTunnel;

  constructor(
    physics: Physics,
    public readonly from: vec2,
    to: vec2,
    fromRadius: number,
    toRadius: number
  ) {
    super();

    this.shape = new DrawableTunnel(from, to, fromRadius, toRadius, this);
    physics.addStaticBoundingBox(this.shape.boundingBox);
    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.drawShape(this.shape);
  }
}
