import { mat2d, vec2 } from 'gl-matrix';
import { Drawable, DrawableDescriptor } from 'sdf-2d';
import { BoundingCircle } from '../../physics/bounds/bounding-circle';

export class BlobShape extends Drawable {
  public static descriptor: DrawableDescriptor = {
    sdf: {
      shader: `
      uniform vec2 headCenters[BLOB_COUNT];
      uniform vec2 leftFootCenters[BLOB_COUNT];
      uniform vec2 rightFootCenters[BLOB_COUNT];
      uniform float headRadii[BLOB_COUNT];
      uniform float footRadii[BLOB_COUNT];
      //uniform float ks[BLOB_COUNT];

      float smoothMin(float a, float b)
      {
        const float k = 80.0;
        float res = exp2( -k*a ) + exp2( -k*b );
        return -log2( res )/k;
      }

      float circleDistance(vec2 circleCenter, float radius, vec2 target) {
        return distance(target, circleCenter) - radius;
      }

      float blobMinDistance(vec2 target, out float colorIndex) {
        float minDistance = 1000.0;
        colorIndex = 3.0;

        for (int i = 0; i < BLOB_COUNT; i++) {
          float headDistance = circleDistance(headCenters[i], headRadii[i], target);
          float leftFootDistance = circleDistance(leftFootCenters[i], footRadii[i], target);
          float rightFootDistance = circleDistance(rightFootCenters[i], footRadii[i], target);

          float res = min(
            smoothMin(headDistance, leftFootDistance),
            smoothMin(headDistance, rightFootDistance)
          );

          minDistance = min(minDistance, res);
        }

        return minDistance;
      }
    `,
      distanceFunctionName: 'blobMinDistance',
    },
    propertyUniformMapping: {
      footRadius: 'footRadii',
      headRadius: 'headRadii',
      rightFootCenter: 'rightFootCenters',
      leftFootCenter: 'leftFootCenters',
      headCenter: 'headCenters',
    },
    uniformCountMacroName: 'BLOB_COUNT',
    shaderCombinationSteps: [0, 1, 10],
    empty: new BlobShape(),
  };
  protected head: BoundingCircle;
  protected leftFoot: BoundingCircle;
  protected rightFoot: BoundingCircle;

  public constructor() {
    super();

    const circle = new BoundingCircle(null, vec2.create(), 200);
    this.setCircles([circle, circle, circle]);
  }

  public setCircles([head, leftFoot, rightFoot]: [
    BoundingCircle,
    BoundingCircle,
    BoundingCircle
  ]) {
    this.head = head;
    this.leftFoot = leftFoot;
    this.rightFoot = rightFoot;
  }

  public minDistance(target: vec2): number {
    return Math.min(
      this.head.distance(target),
      this.leftFoot.distance(target),
      this.rightFoot.distance(target)
    );
  }

  protected getObjectToSerialize(transform2d: mat2d, transform1d: number): any {
    return {
      headCenter: vec2.transformMat2d(vec2.create(), this.head.center, transform2d),
      leftFootCenter: vec2.transformMat2d(
        vec2.create(),
        this.leftFoot.center,
        transform2d
      ),
      rightFootCenter: vec2.transformMat2d(
        vec2.create(),
        this.rightFoot.center,
        transform2d
      ),
      headRadius: this.head.radius * transform1d,
      footRadius: this.leftFoot.radius * transform1d,
    };
  }
}
