import { Renderer } from 'sdf-2d';
import { GameObject } from 'shared';

export interface ViewObject extends GameObject {
  step(deltaTimeInMilliseconds: number): void;
  draw(renderer: Renderer, overlay: HTMLElement): void;
  beforeDestroy(): void;
}
