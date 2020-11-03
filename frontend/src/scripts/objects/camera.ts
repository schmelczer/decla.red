import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { calculateViewArea, GameObject, mixRgb, settings, UpdateProperty } from 'shared';

import { Game } from '../game';
import { ViewObject } from './view-object';

export class Camera extends GameObject implements ViewObject {
  public center: vec2 = vec2.create();

  private aspectRatio?: number;

  constructor(private game: Game) {
    super(null);
  }

  public updateProperties(update: UpdateProperty[]): void {}

  public beforeDestroy(): void {}

  public step(deltaTimeInSeconds: number): void {}

  public draw(renderer: Renderer, overlay: HTMLElement, shouldChangeLayout: boolean) {
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
