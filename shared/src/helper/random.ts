let seed = (Math.random() * 0x100000000) >>> 0;

function getRandom(): number {
  let t = (seed = (seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const Random = {
  set seed(value: number) {
    seed = value | 0;
  },
  getRandom,
  getRandomInRange(from: number, to: number): number {
    return from + getRandom() * (to - from);
  },
  choose<T>(values: Array<T>): T | undefined {
    return values.length === 0
      ? undefined
      : values[Math.floor(getRandom() * values.length)];
  },
};
