import { Renderer } from 'sdf-2d';
import { GameObject, UpdateProperty } from 'shared';

export interface ViewObject extends GameObject {
  step(deltaTimeInMilliseconds: number): void;
  draw(renderer: Renderer, overlay: HTMLElement, shouldChangeLayout: boolean): void;
  updateProperties(update: Array<UpdateProperty>): void;
  beforeDestroy(): void;
}
