import { vec2 } from 'gl-matrix';
import {
  calculateViewArea,
  CommandExecutors,
  GameObject,
  mixRgb,
  settings,
} from 'shared';
import { RenderCommand } from '../../commands/types/render';
import { Game } from '../../game';

export class Camera extends GameObject {
  public center: vec2 = vec2.create();
  private aspectRatio?: number;

  constructor(private game: Game) {
    super(null);
  }

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
  };

  private draw({ renderer }: RenderCommand) {
    const canvasAspectRatio = renderer.canvasSize.x / renderer.canvasSize.y;
    if (canvasAspectRatio !== this.aspectRatio) {
      this.aspectRatio = canvasAspectRatio;
      this.game.aspectRatioChanged(canvasAspectRatio);
    }

    const viewArea = calculateViewArea(this.center, canvasAspectRatio);
    renderer.setViewArea(viewArea.topLeft, viewArea.size);

    renderer.setRuntimeSettings({
      ambientLight: mixRgb(
        settings.backgroundGradient[0],
        settings.backgroundGradient[1],
        vec2.length(this.center) / settings.worldRadius,
      ),
    });
  }
}
