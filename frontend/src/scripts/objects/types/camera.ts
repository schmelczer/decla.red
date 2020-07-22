import { GameObject } from '../game-object';
import { MoveToCommand } from '../../commands/types/move-to';
import { ZoomCommand } from '../../commands/types/zoom';
import { BeforeDrawCommand } from '../../commands/types/before-draw';
import { PrimaryActionCommand } from '../../commands/types/primary-action';
import { vec2 } from 'gl-matrix';
import { CursorMoveCommand } from '../../commands/types/cursor-move-command';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080;
  private cursorPosition = vec2.create();

  constructor() {
    super();

    this.addCommandExecutor(BeforeDrawCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
    this.addCommandExecutor(
      CursorMoveCommand,
      this.setCursorPosition.bind(this)
    );
    this.addCommandExecutor(ZoomCommand, this.zoom.bind(this));
  }

  private draw(c: BeforeDrawCommand) {
    c.drawer.setCameraPosition(this.position);
    c.drawer.setCursorPosition(this.cursorPosition);
    this._boundingBoxSize = c.drawer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    this._position = c.position;
  }

  private zoom(c: ZoomCommand) {
    this.inViewArea *= c.factor;
  }

  private setCursorPosition(c: CursorMoveCommand) {
    this.cursorPosition = c.position;
  }
}
