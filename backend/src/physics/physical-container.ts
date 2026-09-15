import { GameEvents } from '../game-events';
import { BoundingBox } from './bounding-box';
import { Physical } from './physical';

export class PhysicalContainer {
  private objects: Array<Physical> = [];

  constructor(public readonly game: GameEvents) {}

  public addObject(physical: Physical) {
    this.objects.push(physical);
  }

  public removeObject(physical: Physical) {
    this.objects = this.objects.filter((o) => o !== physical);
  }

  public step(deltaTimeInSeconds: number) {
    this.objects.forEach((o) => o.step?.(deltaTimeInSeconds));
  }

  public resetRemoteCalls() {
    this.objects.forEach((o) => o.gameObject.resetRemoteCalls());
  }

  public findIntersecting(box: BoundingBox): Array<Physical> {
    return this.objects.filter((o) => o.boundingBox.intersects(box));
  }
}
