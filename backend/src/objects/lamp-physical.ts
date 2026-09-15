import { vec2, vec3 } from 'gl-matrix';
import { LampBase, settings, id } from 'shared';
import { BoundingBox } from '../physics/bounding-box';
import { Physical } from '../physics/physical';

export class LampPhysical extends LampBase implements Physical {
  public readonly canCollide = false;
  public readonly boundingBox: BoundingBox;

  constructor(center: vec2, color: vec3, lightness: number) {
    super(id(), center, color, lightness);
    this.boundingBox = BoundingBox.ofCircle(center, settings.lightCutoffDistance);
  }

  public get gameObject(): this {
    return this;
  }

  public queueSetLight(color: vec3, lightness: number) {
    this.color = vec3.clone(color);
    this.lightness = lightness;
    this.remoteCall('setLight', color, lightness);
  }

  public distance(target: vec2): number {
    return vec2.distance(this.center, target);
  }
}
