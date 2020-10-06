import { vec2 } from 'gl-matrix';
import { CharacterBase, CommandExecutors, deserializable } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { BlobShape } from '../shapes/blob-shape';

@deserializable(CharacterBase)
export class CharacterView extends CharacterBase {
  private shape = new BlobShape();

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => {
      this.shape.setCircles([this.head, this.leftFoot, this.rightFoot]);
      c.renderer.addDrawable(this.shape);
    },
  };

  public get position(): vec2 {
    return this.head.center;
  }
}
