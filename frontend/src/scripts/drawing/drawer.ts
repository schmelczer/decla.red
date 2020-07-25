import { vec2 } from 'gl-matrix';

export interface Drawer {
  startFrame(deltaTime: DOMHighResTimeStamp): void;
  finishFrame(): void;
  giveUniforms(uniforms: any): void;
  appendToUniformList(listName: string, ...values: Array<any>): void;
  setCameraPosition(position: vec2): void;
  setCursorPosition(position: vec2): void;
  setInViewArea(size: number): vec2;
  screenUvToWorldCoordinate(mousePosition: vec2): vec2;
  drawInfoText(text: string): void;
  isOnScreen(position: vec2): boolean;
}
