export class DeltaTimeCalculator {
  private previousTime: [number, number] = process.hrtime();

  public getNextDeltaTimeInSeconds(setAsBase = false): number {
    const [seconds, nanoSeconds] = process.hrtime(this.previousTime);
    if (setAsBase) {
      this.previousTime = process.hrtime();
    }
    return seconds + nanoSeconds / 1e9;
  }
}
