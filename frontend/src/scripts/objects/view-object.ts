import { Renderer } from 'sdf-2d';
import { GameObject, UpdateMessage } from 'shared';

export interface ViewObject extends GameObject {
  update(updates: Array<UpdateMessage>): void;
  step(deltaTimeInMilliseconds: number): void;
  draw(renderer: Renderer): void;
}
