import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { calculateViewArea, mixRgb, settings } from 'shared';
import type { Game } from '../../game';
import { ScreenShake } from '../../screen-shake';

export class Camera {
  public readonly center: vec2 = vec2.create();
  private aspectRatio?: number;

  constructor(private readonly game: Game) {}

  public follow(target: vec2) {
    vec2.copy(this.center, target);
  }

  public draw(renderer: Renderer) {
    const canvasAspectRatio = renderer.canvasSize[0] / renderer.canvasSize[1];
    if (canvasAspectRatio !== this.aspectRatio) {
      this.aspectRatio = canvasAspectRatio;
      this.game.aspectRatioChanged(canvasAspectRatio);
    }

    const shakenCenter = vec2.fromValues(
      this.center[0] + ScreenShake.offsetX,
      this.center[1] + ScreenShake.offsetY,
    );
    const scale = ScreenShake.viewScale;
    const viewArea = calculateViewArea(shakenCenter, canvasAspectRatio, scale * scale);
    renderer.setViewArea(viewArea.topLeft, viewArea.size);

    const [near, far] = settings.backgroundGradient;
    renderer.setRuntimeSettings({
      ambientLight: mixRgb(near, far, vec2.length(this.center) / settings.worldRadius),
    });
  }
}
