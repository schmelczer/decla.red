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
import { ScreenShake } from '../../screen-shake';

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

    // Shake displaces only the rendered view centre and the zoom-punch shrinks
    // only the rendered view area — neither touches the followed position, so
    // impacts jolt the frame without nudging the camera off the player. Passing
    // the zoom as oversizeRatio scales the area about the (shaken) centre.
    const shakenCenter = vec2.fromValues(
      this.center[0] + ScreenShake.offsetX,
      this.center[1] + ScreenShake.offsetY,
    );
    const scale = ScreenShake.viewScale;
    const viewArea = calculateViewArea(shakenCenter, canvasAspectRatio, scale * scale);
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
