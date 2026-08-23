import { mat2d, vec2 } from 'gl-matrix';
import { Drawable, DrawableDescriptor } from 'sdf-2d';
import { Circle } from 'shared';

export class CharacterShape extends Drawable {
  public static descriptor: DrawableDescriptor = {
    sdf: {
      shader: `
      uniform vec2 characterHeadCenters[CHARACTER_COUNT];
      uniform vec2 characterLeftFeet[CHARACTER_COUNT];
      uniform vec2 characterRightFeet[CHARACTER_COUNT];
      uniform vec2 characterGazeTargets[CHARACTER_COUNT];
      uniform float characterHeadRadii[CHARACTER_COUNT];
      uniform float characterFootRadii[CHARACTER_COUNT];
      uniform int characterColors[CHARACTER_COUNT];
      uniform float characterFlash[CHARACTER_COUNT];

      float circleDistance(vec2 circleCenter, float radius, vec2 target) {
        return distance(target, circleCenter) - radius;
      }

      float segmentDistance(vec2 a, vec2 b, vec2 target) {
        vec2 pa = target - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
      }

      float characterMinDistance(vec2 target, out vec4 color) {
        float minDistance = 1000.0;

        for (int i = 0; i < CHARACTER_COUNT; i++) {
          vec2 head = characterHeadCenters[i];
          vec2 leftFoot = characterLeftFeet[i];
          vec2 rightFoot = characterRightFeet[i];
          float headRadius = characterHeadRadii[i];
          float footRadius = characterFootRadii[i];

          vec2 footAverage = (leftFoot + rightFoot) * 0.5;
          vec2 toHead = head - footAverage;
          float toHeadLength = length(toHead);
          vec2 forward = toHeadLength > 0.001 ? toHead / toHeadLength : vec2(0.0, 1.0);
          vec2 perp = vec2(-forward.y, forward.x);

          float renderRadius = headRadius * 0.75;
          float headDistance = circleDistance(head, renderRadius, target);

          float legThickness = footRadius * 0.35;
          float leftLeg = segmentDistance(head, leftFoot, target) - legThickness;
          float rightLeg = segmentDistance(head, rightFoot, target) - legThickness;

          float footRender = footRadius * 0.7;
          float leftFootDistance = circleDistance(leftFoot, footRender, target);
          float rightFootDistance = circleDistance(rightFoot, footRender, target);

          float body = min(
            headDistance,
            min(min(leftLeg, rightLeg), min(leftFootDistance, rightFootDistance))
          );

          vec2 eyeBase = head + forward * (renderRadius * 0.26);
          vec2 leftEyeCenter = eyeBase + perp * (renderRadius * 0.38);
          vec2 rightEyeCenter = eyeBase - perp * (renderRadius * 0.38);
          float scleraRadius = renderRadius * 0.26;
          float pupilRadius = renderRadius * 0.11;

          vec2 gazeTarget = characterGazeTargets[i];
          float pupilReach = (scleraRadius - pupilRadius) * 0.6;
          vec2 toLeftGaze = gazeTarget - leftEyeCenter;
          vec2 toRightGaze = gazeTarget - rightEyeCenter;
          vec2 leftGaze = length(toLeftGaze) > 0.001 ? normalize(toLeftGaze) : forward;
          vec2 rightGaze = length(toRightGaze) > 0.001 ? normalize(toRightGaze) : forward;

          float sclera = min(
            circleDistance(leftEyeCenter, scleraRadius, target),
            circleDistance(rightEyeCenter, scleraRadius, target)
          );
          float pupil = min(
            circleDistance(leftEyeCenter + leftGaze * pupilReach, pupilRadius, target),
            circleDistance(rightEyeCenter + rightGaze * pupilReach, pupilRadius, target)
          );

          // Uniform control flow on purpose: fwidth needs defined derivatives.
          float eyeAaBase = renderRadius * 0.025;
          #ifdef WEBGL2_IS_AVAILABLE
            float scleraAa = max(eyeAaBase, fwidth(sclera));
            float pupilAa = max(eyeAaBase, fwidth(pupil));
          #else
            float scleraAa = eyeAaBase;
            float pupilAa = eyeAaBase;
          #endif

          if (body < minDistance) {
            minDistance = body;
            color = mix(
              readFromPalette(characterColors[i]),
              vec4(1.0),
              clamp(characterFlash[i], 0.0, 1.0)
            );

            color = mix(color, vec4(10.0, 10.0, 10.0, 1.0), 1.0 - smoothstep(-scleraAa, scleraAa, sclera));
            color = mix(color, vec4(0.04, 0.04, 0.07, 1.0), 1.0 - smoothstep(-pupilAa, pupilAa, pupil));
          }
        }

        return minDistance;
      }
    `,
      distanceFunctionName: 'characterMinDistance',
    },
    propertyUniformMapping: {
      footRadius: 'characterFootRadii',
      headRadius: 'characterHeadRadii',
      rightFootCenter: 'characterRightFeet',
      leftFootCenter: 'characterLeftFeet',
      headCenter: 'characterHeadCenters',
      gazeTarget: 'characterGazeTargets',
      color: 'characterColors',
      flash: 'characterFlash',
    },
    uniformCountMacroName: 'CHARACTER_COUNT',
    shaderCombinationSteps: [0, 1, 2, 8],
    empty: new CharacterShape(0),
  };

  protected head!: Circle;
  protected leftFoot!: Circle;
  protected rightFoot!: Circle;

  public hitFlash = 0;
  public gazeTarget = vec2.create();

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
      gazeTarget: vec2.transformMat2d(vec2.create(), this.gazeTarget, transform2d),
      headRadius: this.head.radius * transform1d,
      footRadius: this.leftFoot.radius * transform1d,
      color: this.color,
      flash: this.hitFlash,
    };
  }
}
