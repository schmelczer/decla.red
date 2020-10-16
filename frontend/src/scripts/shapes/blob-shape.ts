import { mat2d, vec2 } from 'gl-matrix';
import { Drawable, DrawableDescriptor } from 'sdf-2d';
import { Circle } from 'shared';

export class BlobShape extends Drawable {
  public static descriptor: DrawableDescriptor = {
    sdf: {
      shader: `
      uniform vec2 headCenters[BLOB_COUNT];
      uniform vec2 leftFootCenters[BLOB_COUNT];
      uniform vec2 rightFootCenters[BLOB_COUNT];
      uniform float headRadii[BLOB_COUNT];
      uniform float footRadii[BLOB_COUNT];
      uniform int blobColors[BLOB_COUNT];

      float blobSmoothMin(float a, float b)
      {
        const float k = 300.0;
        float res = exp2(-k * a) + exp2(-k * b);
        return -log2(res) / k;
      }

      float circleDistance(vec2 circleCenter, float radius, vec2 target) {
        return distance(target, circleCenter) - radius;
      }

      float blobMinDistance(vec2 target, out vec4 color) {
        float minDistance = 1000.0;

        for (int i = 0; i < BLOB_COUNT; i++) {
          float headDistance = circleDistance(headCenters[i], headRadii[i], target);
          float leftFootDistance = circleDistance(leftFootCenters[i], footRadii[i], target);
          float rightFootDistance = circleDistance(rightFootCenters[i], footRadii[i], target);

          float res = min(
            blobSmoothMin(headDistance, leftFootDistance),
            blobSmoothMin(headDistance, rightFootDistance)
          );

          vec2 leftEyeOffset = vec2(-headRadii[i] * 0.35, headRadii[i] * 0.2);
          vec2 rightEyeOffset = vec2(headRadii[i] * 0.35, headRadii[i] * 0.2);

          float eyeDistance = min(
            circleDistance(headCenters[i] + rightEyeOffset, headRadii[i] * 0.25, target),
            circleDistance(headCenters[i] + leftEyeOffset, headRadii[i] * 0.25, target)
          );

          eyeDistance = max(
            eyeDistance,
            -circleDistance(headCenters[i] + leftEyeOffset + vec2(0, -headRadii[i] * 0.175), headRadii[i] * 0.2, target)
          );
          
          eyeDistance = max(
            eyeDistance,
            -circleDistance(headCenters[i] + rightEyeOffset + vec2(0, -headRadii[i] * 0.175), headRadii[i] * 0.2, target)
          );

          if (res < minDistance) {
            minDistance = res;
            color = eyeDistance < 0.0 ? vec4(1.0) : readFromPalette(blobColors[i]);
          }
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
      color: 'blobColors',
    },
    uniformCountMacroName: 'BLOB_COUNT',
    shaderCombinationSteps: [],
    empty: new BlobShape(0),
  };

  protected head!: Circle;
  protected leftFoot!: Circle;
  protected rightFoot!: Circle;

  public constructor(private readonly color: number) {
    super();

    const circle = new Circle(vec2.create(), 200);
    this.setCircles([circle, circle, circle]);
  }

  public setCircles([head, leftFoot, rightFoot]: [Circle, Circle, Circle]) {
    this.head = head;
    this.leftFoot = leftFoot;
    this.rightFoot = rightFoot;
  }

  public minDistance(target: vec2): number {
    return Math.min(
      this.head.distance(target),
      this.leftFoot.distance(target),
      this.rightFoot.distance(target),
    );
  }

  protected getObjectToSerialize(transform2d: mat2d, transform1d: number): any {
    return {
      headCenter: vec2.transformMat2d(vec2.create(), this.head.center, transform2d),
      leftFootCenter: vec2.transformMat2d(
        vec2.create(),
        this.leftFoot.center,
        transform2d,
      ),
      rightFootCenter: vec2.transformMat2d(
        vec2.create(),
        this.rightFoot.center,
        transform2d,
      ),
      headRadius: this.head.radius * transform1d,
      footRadius: this.leftFoot.radius * transform1d,
      color: this.color,
    };
  }
}
