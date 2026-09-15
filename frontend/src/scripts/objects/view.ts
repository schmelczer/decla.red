import { Renderer } from 'sdf-2d';
import { GameObject, UpdatePropertyCommand } from 'shared';

export interface View extends GameObject {
  step(deltaTimeInSeconds: number): void;
  render(renderer: Renderer, overlay: HTMLElement, shouldChangeLayout: boolean): void;
  beforeDestroy?(): void;
  updateProperty?(update: UpdatePropertyCommand): void;
}
