import { vec2 } from 'gl-matrix';
import { RenderCommand } from '../../commands/types/draw';
import { TunnelShape } from '../../drawing/primitives/tunnel-shape';
import { GameObject } from '../game-object';

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
