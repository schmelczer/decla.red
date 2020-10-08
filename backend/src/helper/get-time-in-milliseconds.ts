export const getTimeInMilliseconds = (): number => {
  const [seconds, nanoSeconds] = process.hrtime();

  return seconds * 1000 + nanoSeconds / 1000 / 1000;
};
