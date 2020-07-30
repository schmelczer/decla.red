import { vec2 } from 'gl-matrix';
import { TunnelShape } from '../../drawing/drawables/primitives/tunnel-shape';
import { GameObject } from '../game-object';
import { RenderCommand } from '../../drawing/commands/render';

export interface Line {}

export class Tunnel extends GameObject {
  private primitive: TunnelShape;

  constructor(from: vec2, to: vec2, fromRadius: number, toRadius: number) {
    super();
    this.primitive = new TunnelShape(from, to, fromRadius, toRadius);
    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.drawPrimitive(this.primitive);
  }
}
