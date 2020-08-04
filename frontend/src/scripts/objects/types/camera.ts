import { vec2 } from 'gl-matrix';
import { BeforeRenderCommand } from '../../drawing/commands/before-render';
import { CursorMoveCommand } from '../../input/commands/cursor-move-command';
import { GameObject } from '../game-object';
import { Lamp } from './lamp';
import { ZoomCommand } from '../../input/commands/zoom';
import { MoveToCommand } from '../../physics/commands/move-to';
import { BoundingBox } from '../../physics/containers/bounding-box';
import { Physics } from '../../physics/physics';

export class Camera extends GameObject {
  private inViewArea = 1920 * 1080 * 5;
  private cursorPosition = vec2.create();
  private boundingBox: BoundingBox;

  constructor(physics: Physics, private light: Lamp) {
    super();

    this.boundingBox = new BoundingBox(null);
    physics.addDynamicBoundingBox(this.boundingBox);

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
    console.log('camera', this.boundingBox.topLeft);

    c.renderer.setCameraPosition(this.boundingBox.topLeft);
    c.renderer.setCursorPosition(this.cursorPosition);
    this.boundingBox.size = c.renderer.setInViewArea(this.inViewArea);
  }

  private moveTo(c: MoveToCommand) {
    console.log('camera', c.position);
    this.boundingBox.topLeft = c.position;
    this.light.sendCommand(
      new MoveToCommand(
        vec2.add(
          vec2.create(),
          c.position,
          vec2.scale(vec2.create(), this.boundingBox.size, 0.5)
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
