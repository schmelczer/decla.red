import { vec2 } from 'gl-matrix';
import { MoveToCommand } from '../../commands/move-to';
import { RenderCommand } from '../../commands/render';
import { CursorMoveCommand } from '../../input/commands/cursor-move-command';
import { ZoomCommand } from '../../input/commands/zoom';
import { BoundingBox } from '../../physics/bounds/bounding-box';
import { GameObject } from '../game-object';

export class Camera extends GameObject {
  private inViewAreaSize = 1920 * 1080 * 2;
  private cursorPosition = vec2.create();

  private _viewArea: BoundingBox;

  constructor() {
    super();

    this._viewArea = new BoundingBox(null);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
    this.addCommandExecutor(CursorMoveCommand, this.setCursorPosition.bind(this));
    this.addCommandExecutor(ZoomCommand, this.zoom.bind(this));
  }

  public get viewArea(): BoundingBox {
    return this._viewArea;
  }

  private draw(c: RenderCommand) {
    const canvasAspectRatio = c.renderer.canvasSize.x / c.renderer.canvasSize.y;

    this.viewArea.size = vec2.fromValues(
      Math.sqrt(this.inViewAreaSize * canvasAspectRatio),
      Math.sqrt(this.inViewAreaSize / canvasAspectRatio)
    );

    c.renderer.setViewArea(this._viewArea.topLeft, this.viewArea.size);
    //c.renderer.setCursorPosition(this.cursorPosition);
  }

  private moveTo(c: MoveToCommand) {
    this._viewArea.topLeft = vec2.fromValues(
      c.position.x - this._viewArea.size.x / 2,
      c.position.y + this._viewArea.size.y / 2
    );
  }

  private zoom(c: ZoomCommand) {
    this.inViewAreaSize *= c.factor;
  }

  private setCursorPosition(c: CursorMoveCommand) {
    this.cursorPosition = c.position;
  }
}
