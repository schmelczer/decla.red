import { vec2 } from 'gl-matrix';
import { InvertedTunnel } from 'sdf-2d';
import { CommandExecutors, deserializable, Id, TunnelBase } from 'shared';
import { RenderCommand } from '../commands/types/render';

@deserializable(TunnelBase)
export class TunnelView extends TunnelBase {
  private shape: InvertedTunnel;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.shape),
  } as any;

  constructor(id: Id, from: vec2, to: vec2, fromRadius: number, toRadius: number) {
    super(id, from, to, fromRadius, toRadius);
    this.shape = new InvertedTunnel(from, to, fromRadius, toRadius);
  }
}
