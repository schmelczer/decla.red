import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import { CommandExecutors, deserializable, Id, LampBase } from 'shared';
import { RenderCommand } from '../commands/types/render';

@deserializable(LampBase)
export class LampView extends LampBase {
  private light: CircleLight;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.light),
  } as any;

  constructor(id: Id, center: vec2, color: vec3, lightness: number) {
    super(id, center, color, lightness);
    this.light = new CircleLight(center, color, lightness);
  }
}
