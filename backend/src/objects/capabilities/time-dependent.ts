export interface TimeDependent {
  step(deltaTimeInSeconds: number): void;
}

export const timeDependent = (a: any): a is TimeDependent => a && 'step' in a;
