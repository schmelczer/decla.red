import { mat2d, vec2 } from 'gl-matrix';
import { Circle, Drawable, DrawableDescriptor } from 'sdf-2d';
import { GameObject } from '../../objects/game-object';
import { BoundingBox } from '../bounding-box';
import { IShape } from '../i-shape';
import { CircleShape } from './circle-shape';

export class BlobShape extends Drawable implements IShape {
  public static descriptor: DrawableDescriptor = {
    sdf: {
      shader: `
        uniform struct {
          vec2 headCenter;
          vec2 leftFootCenter;
          vec2 rightFootCenter;
          float headRadius;
          float footRadius;
          float k;
        }[BLOB_COUNT] blobs;

        float smoothMin(float a, float b)
        {
          const float k = 80.0;
          float res = exp2( -k*a ) + exp2( -k*b );
          return -log2( res )/k;
        }

        float circleDistance(vec2 circleCenter, float radius) {
          return distance(position, circleCenter) - radius;
        }

        void blobMinDistance(inout float minDistance, inout float color) {
          for (int i = 0; i < BLOB_COUNT; i++) {
            float headDistance = circleDistance(blobs[i].headCenter, blobs[i].headRadius);
            float leftFootDistance = circleDistance(blobs[i].leftFootCenter, blobs[i].footRadius);
            float rightFootDistance = circleDistance(blobs[i].rightFootCenter, blobs[i].footRadius);

            float res = min(
              smoothMin(headDistance, leftFootDistance),
              smoothMin(headDistance, rightFootDistance)
            );

            minDistance = min(minDistance, res);
            color = mix(1.0, color, step(distanceNdcPixelSize + SURFACE_OFFSET, res));
          }
        }
      `,
      distanceFunctionName: 'blobMinDistance',
    },
    uniformName: 'blobs',
    uniformCountMacroName: 'BLOB_COUNT',
    shaderCombinationSteps: [1],
    empty: new BlobShape(vec2.fromValues(0, 0)),
  };

  public readonly boundingCircleRadius = 100;

  protected readonly headRadius = 40;
  protected readonly footRadius = 15;

  private readonly headOffset = vec2.fromValues(0, -15);
  private readonly leftFootOffset = vec2.fromValues(-12, -60);
  private readonly rightFootOffset = vec2.fromValues(12, -60);

  public readonly isInverted = false;
  protected boundingCircle = new CircleShape(vec2.create(), this.boundingCircleRadius);
  protected head = new Circle(vec2.create(), this.headRadius);
  protected leftFoot = new Circle(vec2.create(), this.footRadius);
  protected rightFoot = new Circle(vec2.create(), this.footRadius);

  public constructor(center: vec2, public readonly gameObject: GameObject = null) {
    super();
    this.position = center;
  }

  public set position(value: vec2) {
    vec2.copy(this.boundingCircle.center, value);
    vec2.add(this.head.center, value, this.headOffset);
    vec2.add(this.leftFoot.center, value, this.leftFootOffset);
    vec2.add(this.rightFoot.center, value, this.rightFootOffset);
  }

  public get center(): vec2 {
    return this.boundingCircle.center;
  }

  public get radius(): number {
    return this.boundingCircle.radius;
  }

  public minDistance(target: vec2): number {
    return this.boundingCircle.minDistance(target);
  }
  public normal(from: vec2): vec2 {
    return this.boundingCircle.normal(from);
  }

  public get boundingBox(): BoundingBox {
    return this.boundingCircle.boundingBox;
  }

  public isInside(target: vec2): boolean {
    return this.minDistance(target) < 0;
  }

  public clone(): BlobShape {
    return new BlobShape(this.boundingCircle.center, this.gameObject);
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
      headRadius: this.headRadius * transform1d,
      footRadius: this.footRadius * transform1d,
    };
  }
}
