import { vec2 } from 'gl-matrix';
import { IPrimitive } from './drawables/primitives/i-primitive';
import { ILight } from './drawables/lights/i-light';

export interface IRenderer {
  startFrame(deltaTime: DOMHighResTimeStamp): void;
  finishFrame(): void;

  drawPrimitive(primitive: IPrimitive): void;
  drawLight(light: ILight): void;
  drawInfoText(text: string): void;

  setCameraPosition(position: vec2): void;
  setCursorPosition(position: vec2): void;
  setInViewArea(size: number): vec2;
}
