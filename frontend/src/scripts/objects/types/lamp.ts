import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import { RenderCommand } from '../../graphics/commands/render';
import { MoveToCommand } from '../../physics/commands/move-to';
import { GameObject } from '../game-object';

export class Lamp extends GameObject {
  private light: CircleLight;

  constructor(center: vec2, color: vec3, lightness: number) {
    super();

    this.light = new CircleLight(center, color, lightness);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.addDrawable(this.light);
  }

  private moveTo(c: MoveToCommand) {
    this.light.center = c.position;
  }
}
