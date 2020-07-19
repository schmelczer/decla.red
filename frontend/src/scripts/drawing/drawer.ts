import { Vec2 } from '../math/vec2';

export interface Drawer {
  startFrame();
  finishFrame();
  setCameraPosition(position: Vec2);
  setInViewWidth(size: number): Vec2;
  drawInfoText(text: string);
}
