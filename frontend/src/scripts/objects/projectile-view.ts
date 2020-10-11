import { vec2 } from 'gl-matrix';
import { Circle } from 'sdf-2d';
import { CommandExecutors, Id } from 'shared';
import { ProjectileBase } from 'shared/src/objects/types/projectile-base';
import { RenderCommand } from '../commands/types/render';

export class ProjectileView extends ProjectileBase {
  private circle: Circle;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.circle),
  };

  constructor(id: Id, center: vec2, radius: number) {
    super(id, center, radius);
    this.circle = new Circle(center, radius);
  }
}
