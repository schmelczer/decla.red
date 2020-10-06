export class DeltaTimeCalculator {
  private previousTime: [number, number] = process.hrtime();

  public getNextDeltaTimeInMilliseconds(): number {
    const deltaTime = process.hrtime(this.previousTime);
    this.previousTime = process.hrtime();

    const [seconds, nanoSeconds] = deltaTime;

    return seconds * 1000 + nanoSeconds / 1000 / 1000;
  }
}
