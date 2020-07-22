import { vec2 } from 'gl-matrix';

export interface Drawer {
  startFrame(): void;
  finishFrame(): void;
  giveUniforms(uniforms: any): void;
  setCameraPosition(position: vec2): void;
  setCursorPosition(position: vec2): void;
  setInViewArea(size: number): vec2;
  drawInfoText(text: string): void;
  isOnScreen(position: vec2): boolean;
}
