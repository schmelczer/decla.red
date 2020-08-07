import { IDrawable } from '../i-drawable';

export interface IPrimitive extends IDrawable {
  clone(): IPrimitive
}
