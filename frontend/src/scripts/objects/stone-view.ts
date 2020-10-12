import { vec2 } from 'gl-matrix';
import { Drawable, Renderer } from 'sdf-2d';
import { CommandExecutors, Id, StoneBase } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { Polygon } from '../shapes/polygon';
import { ViewObject } from './view-object';

export class StoneView extends StoneBase implements ViewObject {
  private shape: Drawable;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.shape),
  };

  constructor(id: Id, vertices: Array<vec2>) {
    super(id, vertices);
    this.shape = new Polygon(vertices);
  }

  public step(deltaTimeInMilliseconds: number): void {}

  public draw(renderer: Renderer): void {
    renderer.addDrawable(this.shape);
  }
}
