import { vec2 } from 'gl-matrix';
import { Drawable, Renderer } from 'sdf-2d';
import { CommandExecutors, Id, Random, PlanetBase, UpdateMessage } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { Polygon } from '../shapes/polygon';
import { ViewObject } from './view-object';

export class PlanetView extends PlanetBase implements ViewObject {
  private shape: Drawable;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.shape),
  };

  constructor(id: Id, vertices: Array<vec2>) {
    super(id, vertices);
    this.shape = new Polygon(vertices);
    (this.shape as any).randomOffset = Random.getRandom();
  }

  public update(message: Array<UpdateMessage>): void {
    throw new Error('Method not implemented.');
  }

  public step(deltaTimeInMilliseconds: number): void {
    (this.shape as any).randomOffset += deltaTimeInMilliseconds / 4000;
  }

  public draw(renderer: Renderer): void {
    renderer.addDrawable(this.shape);
  }
}
