/*import { vec2 } from 'gl-matrix';
import { rotate90Deg } from '../helper/rotate-90-deg';
import { settings } from '../settings';
import { BoundingBoxBase } from './bounds/bounding-box-base';
import { BoundingCircle } from './bounds/bounding-circle';
import { ImmutableBoundingBox } from './bounds/immutable-bounding-box';
import { BoundingBoxList } from './containers/bounding-box-list';
import { BoundingBoxTree } from './containers/bounding-box-tree';

export class Physics {
  private isTreeInitialized = false;
  private staticBoundingBoxesWaitList = [];
  private staticBoundingBoxes = new BoundingBoxTree();
  private dynamicBoundingBoxes = new BoundingBoxList();

  public addStaticBoundingBox(boundingBox: ImmutableBoundingBox) {
    if (!this.isTreeInitialized) {
      this.staticBoundingBoxesWaitList.push(boundingBox);
    } else {
      this.staticBoundingBoxes.insert(boundingBox);
    }
  }

  public addDynamicBoundingBox(boundingBox: BoundingBoxBase) {
    this.dynamicBoundingBoxes.insert(boundingBox);
  }

  public removeDynamicBoundingBox(boundingBox: BoundingBoxBase) {
    this.dynamicBoundingBoxes.remove(boundingBox);
  }

  public tryMovingDynamicCircle(
    circle: BoundingCircle,
    delta: vec2
  ): {
    realDelta: vec2;
    hitSurface: boolean;
    normal?: vec2;
    tangent?: vec2;
  } {
    circle.center = vec2.add(circle.center, circle.center, delta);

    const intersecting = this.findIntersecting(circle.boundingBox).filter(
      (b) =>
        b.owner !== circle.owner && circle.areIntersecting(b.owner) && b.owner.canCollide
    );

    if (intersecting.length === 0) {
      return {
        realDelta: delta,
        hitSurface: false,
      };
    }

    const points = circle.getPerimeterPoints(settings.hitDetectionCirclePointCount);

    const distancesOfPoints = points
      .map((point) => ({
        point,
        closest: intersecting
          .map((i) => ({
            inverted: i.isInverted,
            distance: i.owner.distance(point),
          }))
          .sort((a, b) => a.distance - b.distance)[0],
      }))
      .filter((i) => i.closest);

    const distancesOfIntersectingPoints = distancesOfPoints.filter(
      (d) =>
        (d.closest.distance > 0 && d.closest.inverted) ||
        (d.closest.distance < 0 && !d.closest.inverted)
    );

    if (distancesOfIntersectingPoints.length === 0) {
      return {
        realDelta: delta,
        hitSurface: false,
      };
    }

    const deltas = distancesOfIntersectingPoints.map((pointDistance) => {
      vec2.subtract(pointDistance.point, circle.center, pointDistance.point);
      vec2.normalize(pointDistance.point, pointDistance.point);
      vec2.scale(
        pointDistance.point,
        pointDistance.point,
        (pointDistance.closest.inverted ? 1 : -1) * pointDistance.closest.distance
      );
      return pointDistance.point;
    });

    const approxNormal = deltas.reduce(
      (sum, current) => vec2.add(sum, sum, current),
      vec2.create()
    );
    vec2.scale(approxNormal, approxNormal, 1 / deltas.length);

    circle.center = vec2.add(circle.center, circle.center, approxNormal);

    return {
      realDelta: delta,
      hitSurface: true,
      normal: vec2.normalize(approxNormal, approxNormal),
      tangent: rotate90Deg(approxNormal),
    };
  }

  public findIntersecting(box: BoundingBoxBase): Array<BoundingBoxBase> {
    return [
      ...this.staticBoundingBoxes.findIntersecting(box),
      ...this.dynamicBoundingBoxes.findIntersecting(box),
    ];
  }

  public start() {
    this.staticBoundingBoxes.build(this.staticBoundingBoxesWaitList);
    this.isTreeInitialized = true;
  }
}
*/
