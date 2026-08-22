let _seed = Math.random();

export function setRandomSeed(value: number) {
  _seed = value;
}

export function chooseRandom<T>(values: Array<T>): T | undefined {
  const to = values.length;
  if (to === 0) {
    return undefined;
  }
  return values[Math.floor(getRandomInRange(0, to))];
}

export function getRandomInRange(from: number, to: number): number {
  return from + getRandom() * (to - from);
}

export function getRandom(): number {
  let t = (_seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const Random = {
  get seed() {
    return _seed;
  },
  set seed(v: number) {
    _seed = v;
  },
  choose: chooseRandom,
  getRandomInRange,
  getRandom,
};
