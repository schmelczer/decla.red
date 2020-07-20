import { Vec2 } from '../math/vec2';
import { Rectangle } from '../math/rectangle';

export interface Drawer {
  startFrame(): void;
  finishFrame(): void;
  giveUniforms(uniforms: any): void;
  setCameraPosition(position: Vec2): void;
  setInViewArea(size: number): Vec2;
  drawInfoText(text: string): void;
  isOnScreen(position: Vec2): boolean;
}
