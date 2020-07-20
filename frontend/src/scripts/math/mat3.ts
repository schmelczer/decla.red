// https://github.com/Azleur/mat3/blob/master/src/index.ts

import { Vec2 } from './vec2';

export class Mat3 {
  constructor(private readonly values: Array<Array<number>>) {}

  public static get Zero() {
    return new Mat3([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  }

  public static get Id() {
    return new Mat3([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  }

  public static get Ones() {
    return new Mat3([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
  }

  public static translateMatrix(by: Vec2): Mat3 {
    return new Mat3([
      [1, 0, 0],
      [0, 1, 0],
      [by.x, by.y, 1],
    ]);
  }

  public static scaleMatrix(by: Vec2): Mat3 {
    return new Mat3([
      [by.x, 0, 0],
      [0, by.y, 0],
      [0, 0, 1],
    ]);
  }

  public get transposed(): Mat3 {
    const values: number[][] = [[], [], []];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        values[i][j] = this.values[j][i];
      }
    }
    return new Mat3(values);
  }

  public times(other: Mat3): Mat3 {
    const values: number[][] = Mat3.Zero.values;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          values[i][j] += this.values[i][k] * other.values[k][j];
        }
      }
    }
    return new Mat3(values);
  }

  public get transposedFlat(): Array<number> {
    const transposed = this.transposed;
    return [
      ...transposed.values[0],
      ...transposed.values[1],
      ...transposed.values[2],
    ];
  }
}
