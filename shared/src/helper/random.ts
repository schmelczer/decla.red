// source
// https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
// Mulberry32

export abstract class Random {
  private static _seed = Math.random();

  public static set seed(value: number) {
    Random._seed = value;
  }

  public static choose<T>(values: Array<T>): T | undefined {
    const to = values.length;
    if (to === 0) {
      return undefined;
    }

    return values[Math.floor(this.getRandomInRange(0, to))];
  }

  public static getRandomInRange(from: number, to: number): number {
    return from + this.getRandom() * (to - from);
  }

  public static getRandom(): number {
    let t = (Random._seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
