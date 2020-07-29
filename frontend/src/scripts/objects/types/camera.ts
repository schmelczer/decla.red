import { vec2 } from 'gl-matrix';
import { BeforeRenderCommand } from '../../commands/types/before-render';
import { CursorMoveCommand } from '../../commands/types/cursor-move-command';
import { MoveToCommand } from '../../commands/types/move-to';
import { ZoomCommand } from '../../commands/types/zoom';
import { GameObject } from '../game-object';
import { Lamp } from './lamp';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080 * 5;
  private cursorPosition = vec2.create();

  constructor(private light: Lamp) {
    super();

    this.addCommandExecutor(BeforeRenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
    this.addCommandExecutor(
      CursorMoveCommand,
      this.setCursorPosition.bind(this)
    );
    this.addCommandExecutor(ZoomCommand, this.zoom.bind(this));
  }

  private draw(c: BeforeRenderCommand) {
    c.renderer.setCameraPosition(this.position);
    c.renderer.setCursorPosition(this.cursorPosition);
    this._boundingBoxSize = c.renderer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    this._position = c.position;
    this.light.sendCommand(
      new MoveToCommand(
        vec2.add(
          vec2.create(),
          c.position,
          vec2.scale(vec2.create(), this.boundingBoxSize, 0.5)
        )
      )
    );
  }

  private zoom(c: ZoomCommand) {
    this.inViewArea *= c.factor;
  }

  private setCursorPosition(c: CursorMoveCommand) {
    this.cursorPosition = c.position;
  }
}
