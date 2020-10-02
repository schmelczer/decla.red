import { vec2 } from 'gl-matrix';
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

  public tryMovingDynamicCircle(
    circle: BoundingCircle,
    delta: vec2,
    invocationCount = 0
  ) {
    circle.center = vec2.add(circle.center, circle.center, delta);

    const intersecting = this.findIntersecting(circle.boundingBox).filter(
      (b) =>
        b.owner !== circle.owner && circle.areIntersecting(b.owner) && b.owner.canCollide
    );

    const pointCount = 16;
    const points = circle.getPerimeterPoints(pointCount);

    const distancesOfPoints = points.map((point) => ({
      point,
      distances: intersecting.map((i) => i.owner.distance(point)).sort((a, b) => a - b),
    }));

    const distancesOfIntersectingPoints = distancesOfPoints.filter(
      (d) => d.distances[0] > 0
    );

    if (distancesOfIntersectingPoints.length === 0) {
      return;
    }

    const distanceToLeastIntersectingForEachPoint = distancesOfIntersectingPoints.map(
      (pointDistances) => ({
        point: pointDistances.point,
        distance: pointDistances.distances[0],
      })
    );

    const deltas = distanceToLeastIntersectingForEachPoint.map((pointDistance) => {
      vec2.subtract(pointDistance.point, circle.center, pointDistance.point);
      vec2.normalize(pointDistance.point, pointDistance.point);

      vec2.scale(pointDistance.point, pointDistance.point, pointDistance.distance);
      return pointDistance.point;
    });

    const sumDelta = vec2.fromValues(0, 0);

    deltas.forEach((d) => vec2.add(sumDelta, sumDelta, d));

    vec2.scale(sumDelta, sumDelta, 1 / deltas.length);

    if (invocationCount > 10) {
      return;
    }

    this.tryMovingDynamicCircle(circle, sumDelta, ++invocationCount);
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
