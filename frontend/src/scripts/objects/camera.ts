import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { calculateViewArea, GameObject, mixRgb, settings, UpdateMessage } from 'shared';

import { Game } from '../game';
import { ViewObject } from './view-object';

export class Camera extends GameObject implements ViewObject {
  public center: vec2 = vec2.create();

  private aspectRatio?: number;

  constructor(private game: Game) {
    super(null);
  }

  public update(updates: Array<UpdateMessage>) {
    throw new Error();
  }

  public step(deltaTimeInMilliseconds: number): void {}

  public draw(renderer: Renderer) {
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
        (this.center.x - settings.worldLeftEdge) /
          (Math.abs(settings.worldLeftEdge) + Math.abs(settings.worldRightEdge)),
      ),
    });
  }
}
