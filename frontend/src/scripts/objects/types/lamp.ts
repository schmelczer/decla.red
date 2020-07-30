import { vec2, vec3 } from 'gl-matrix';
import { GameObject } from '../game-object';
import { CircleLight } from '../../drawing/drawables/lights/circle-light';
import { RenderCommand } from '../../drawing/commands/render';
import { MoveToCommand } from '../../physics/commands/move-to';

export class Lamp extends GameObject {
  private light: CircleLight;

  constructor(center: vec2, radius: number, color: vec3, lightness: number) {
    super();

    this.light = new CircleLight(center, radius, color, lightness);

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
    this.addCommandExecutor(MoveToCommand, this.moveTo.bind(this));
  }

  private draw(c: RenderCommand) {
    c.renderer.drawLight(this.light);
  }

  private moveTo(c: MoveToCommand) {
    this.light.center = c.position;
  }
}
