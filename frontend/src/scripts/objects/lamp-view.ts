import { vec2, vec3 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import { CommandExecutors, Id, LampBase, UpdateProperty } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { ViewObject } from './view-object';

export class LampView extends LampBase implements ViewObject {
  private light: CircleLight;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.light),
  };

  constructor(id: Id, center: vec2, color: vec3, lightness: number) {
    super(id, center, color, lightness);
    this.light = new CircleLight(center, color, lightness);
  }

  public updateProperties(update: UpdateProperty[]): void {}

  public step(deltaTimeInSeconds: number): void {}

  public beforeDestroy(): void {}

  public draw(
    renderer: Renderer,
    overlay: HTMLElement,
    shouldChangeLayout: boolean,
  ): void {
    renderer.addDrawable(this.light);
  }
}
