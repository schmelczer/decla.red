import { vec2 } from 'gl-matrix';
import { ILight } from './drawables/lights/i-light';
import { IDrawable } from './drawables/i-drawable';
import { BoundingBoxBase } from '../shapes/bounding-box-base';

export interface IRenderer {
  startFrame(deltaTime: DOMHighResTimeStamp): void;
  finishFrame(): void;

  drawShape(drawable: IDrawable): void;
  drawLight(light: ILight): void;
  drawInfoText(text: string): void;

  readonly canvasSize: vec2;
  setViewArea(viewArea: BoundingBoxBase): void;
  setCursorPosition(position: vec2): void;
}
