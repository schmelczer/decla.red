import { vec2 } from 'gl-matrix';
import { BoundingBoxBase } from '../shapes/bounding-box-base';
import { IDrawable } from './drawables/i-drawable';
import { ILight } from './drawables/lights/i-light';

export interface IRenderer {
  initialize(): Promise<void>;

  startFrame(deltaTime: DOMHighResTimeStamp): void;
  finishFrame(): void;

  drawShape(drawable: IDrawable): void;
  drawLight(light: ILight): void;
  drawInfoText(text: string): void;

  readonly canvasSize: vec2;
  setViewArea(viewArea: BoundingBoxBase): void;
  setCursorPosition(position: vec2): void;
}
