import { vec2, vec3 } from 'gl-matrix';
import { RenderCommand } from '../../commands/types/draw';
import { MoveToCommand } from '../../commands/types/move-to';
import { GameObject } from '../game-object';
import { CircleLight } from '../../drawing/lights/circle-light';

const range = 2000;

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
