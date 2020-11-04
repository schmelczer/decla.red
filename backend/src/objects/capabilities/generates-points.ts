export interface GeneratesPoints {
  getPoints(): {
    decla: number;
    red: number;
  };
}

export const generatesPoints = (a: any): a is GeneratesPoints => a && 'getPoints' in a;
