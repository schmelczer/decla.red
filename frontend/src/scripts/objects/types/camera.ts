import { vec2 } from 'gl-matrix';
import { BeforeRenderCommand } from '../../drawing/commands/before-render';
import { CursorMoveCommand } from '../../input/commands/cursor-move-command';
import { ZoomCommand } from '../../input/commands/zoom';
import { MoveToCommand } from '../../physics/commands/move-to';
import { BoundingBox } from '../../shapes/bounding-box';
import { Physics } from '../../physics/physics';
import { GameObject } from '../game-object';
import { Lamp } from './lamp';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080 * 5;
  private cursorPosition = vec2.create();
  private boundingBox: BoundingBox;

  constructor(physics: Physics, private light: Lamp) {
    super();

    this.boundingBox = new BoundingBox(null);
    //physics.addDynamicBoundingBox(this.boundingBox);

    this.addCommandExecutor(BeforeRenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
    this.addCommandExecutor(
      CursorMoveCommand,
      this.setCursorPosition.bind(this)
    );
    this.addCommandExecutor(ZoomCommand, this.zoom.bind(this));
  }

  public get viewAreaSize(): vec2 {
    return this.boundingBox.size;
  }

  private draw(c: BeforeRenderCommand) {
    c.renderer.setCameraPosition(this.boundingBox.topLeft);
    c.renderer.setCursorPosition(this.cursorPosition);
    this.boundingBox.size = c.renderer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    this.boundingBox.topLeft = c.position;
    this.light.sendCommand(c);
  }

  private zoom(c: ZoomCommand) {
    this.inViewArea *= c.factor;
  }

  private setCursorPosition(c: CursorMoveCommand) {
    this.cursorPosition = c.position;
  }
}
