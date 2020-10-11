import { vec2 } from 'gl-matrix';
import { InvertedTunnel } from 'sdf-2d';
import { CommandExecutors, Id, TunnelBase } from 'shared';
import { RenderCommand } from '../commands/types/render';

export class TunnelView extends TunnelBase {
  private shape: InvertedTunnel;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.shape),
  };

  constructor(id: Id, from: vec2, to: vec2, fromRadius: number, toRadius: number) {
    super(id, from, to, fromRadius, toRadius);
    this.shape = new InvertedTunnel(from, to, fromRadius, toRadius);
  }
}
