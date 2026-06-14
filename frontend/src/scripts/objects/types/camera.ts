import { vec2 } from 'gl-matrix';
import {
  calculateViewArea,
  CommandExecutors,
  CommandReceiver,
  mixRgb,
  settings,
} from 'shared';
import { RenderCommand } from '../../commands/types/render';
import { Game } from '../../game';

export class Camera extends CommandReceiver {
  public center: vec2 = vec2.create();
  private aspectRatio?: number;

  // A short exponential lag masks any residual stepping in the followed
  // position without the camera noticeably trailing during normal movement.
  private static readonly followSeconds = 0.08;

  // Swooshing across half the map after a respawn would be disorienting;
  // beyond this distance the camera cuts instead.
  private static readonly snapDistance = 1500;

  constructor(private game: Game) {
    super();
  }

  public follow(target: vec2, deltaTimeInSeconds: number) {
    if (vec2.distance(target, this.center) > Camera.snapDistance) {
      vec2.copy(this.center, target);
      return;
    }

    const q = 1 - Math.exp(-deltaTimeInSeconds / Camera.followSeconds);
    vec2.lerp(this.center, this.center, target, q);
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
