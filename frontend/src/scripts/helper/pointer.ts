import { vec2 } from 'gl-matrix';

export class Pointer {
  private static displayPosition: vec2 | null = null;

  public static setDisplayPosition(x: number, y: number): void {
    Pointer.displayPosition = vec2.fromValues(x, y);
  }

  public static getDisplayPosition(): vec2 | null {
    return Pointer.displayPosition;
  }
}
