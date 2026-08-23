export interface GameEvents {
  addPoints(blue: number, red: number): void;
  announce(text: string): void;
}
