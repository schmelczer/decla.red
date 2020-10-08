import { vec2 } from 'gl-matrix';
import { calculateViewArea, CommandExecutors, GameObject } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { Game } from '../game';

export class Camera extends GameObject {
  public center: vec2 = vec2.create();

  private aspectRatio?: number;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
  };

  constructor(private game: Game) {
    super(null);
  }

  private draw(c: RenderCommand) {
    const canvasAspectRatio = c.renderer.canvasSize.x / c.renderer.canvasSize.y;
    if (canvasAspectRatio !== this.aspectRatio) {
      this.aspectRatio = canvasAspectRatio;
      this.game.aspectRatioChanged(canvasAspectRatio);
    }

    const viewArea = calculateViewArea(this.center, canvasAspectRatio);
    c.renderer.setViewArea(viewArea.topLeft, viewArea.size);
  }
}
