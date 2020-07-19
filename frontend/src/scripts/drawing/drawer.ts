import { Vec2 } from '../math/vec2';

export interface Drawer {
  startWaitingForInstructions();
  finishWaitingForInstructions();
  setCameraPosition(position: Vec2);
  setViewBoxSize(size: Vec2);
  drawCornerText(text: string);
}
