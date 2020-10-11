import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import { CommandExecutors, Id, LampBase } from 'shared';
import { RenderCommand } from '../commands/types/render';

export class LampView extends LampBase {
  private light: CircleLight;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.light),
  };

  constructor(id: Id, center: vec2, color: vec3, lightness: number) {
    super(id, center, color, lightness);
    this.light = new CircleLight(center, color, lightness);
  }
}
