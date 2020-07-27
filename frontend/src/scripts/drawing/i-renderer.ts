import { vec2 } from 'gl-matrix';
import { Circle } from './primitives/circle';
import { IPrimitive } from './primitives/i-primitive';

export interface IRenderer {
  startFrame(deltaTime: DOMHighResTimeStamp): void;
  finishFrame(): void;

  drawPrimitive(primitive: IPrimitive): void;

  setCameraPosition(position: vec2): void;
  setCursorPosition(position: vec2): void;
  setInViewArea(size: number): vec2;

  giveUniforms(uniforms: any): void;
  appendToUniformList(listName: string, ...values: Array<any>): void;

  screenUvToWorldCoordinate(mousePosition: vec2): vec2;
  drawInfoText(text: string): void;
  isOnScreen(boundingCircle: Circle): boolean;
  isPositionOnScreen(position: vec2): boolean;
}
