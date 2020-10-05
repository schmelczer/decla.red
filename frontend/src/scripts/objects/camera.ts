import { vec2 } from 'gl-matrix';
import { CommandExecutors, GameObject, Rectangle, settings } from 'shared';
import { RenderCommand } from '../commands/types/render';

export class Camera extends GameObject {
  private static readonly inViewAreaSize = settings.inViewAreaSize;
  private _viewArea = new Rectangle();

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
  };

  constructor(public center: vec2 = vec2.create()) {
    super(null);
  }

  public get viewArea(): Rectangle {
    return this._viewArea;
  }

  private draw(c: RenderCommand) {
    const canvasAspectRatio = c.renderer.canvasSize.x / c.renderer.canvasSize.y;

    this._viewArea.topLeft = vec2.fromValues(
      this.center.x - this._viewArea.size.x / 2,
      this.center.y + this._viewArea.size.y / 2
    );

    this._viewArea.size = vec2.fromValues(
      Math.sqrt(Camera.inViewAreaSize * canvasAspectRatio),
      Math.sqrt(Camera.inViewAreaSize / canvasAspectRatio)
    );

    c.renderer.setViewArea(this._viewArea.topLeft, this._viewArea.size);
  }
}
