import { mat2d, vec2 } from 'gl-matrix';
import { Drawable, DrawableDescriptor } from 'sdf-2d';
import { Circle } from 'shared';

// A single character silhouette shared by every team (teams differ only by
// colour): a circular head sitting on two thin line-legs that run down to the
// two feet.
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

      // Distance to the segment a->b; subtract a radius to get a capsule (a
      // rounded thick line).
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

          // The server rotates the whole posture toward travel, so the head
          // leads: forward is the facing direction, perp its 90deg rotation, so
          // the face sits on the leading side and reads at any rotation.
          vec2 footAverage = (leftFoot + rightFoot) * 0.5;
          vec2 toHead = head - footAverage;
          float toHeadLength = length(toHead);
          vec2 forward = toHeadLength > 0.001 ? toHead / toHeadLength : vec2(0.0, 1.0);
          vec2 perp = vec2(-forward.y, forward.x);

          // A circular head, drawn a bit smaller than the head->feet gap so the
          // legs below it read as two distinct LINES rather than being swallowed
          // by the head.
          float renderRadius = headRadius * 0.75;
          float headDistance = circleDistance(head, renderRadius, target);

          // Legs as thin line-segments (capsules) from the head down to each
          // foot, hard-min'd onto the head so the head stays a crisp circle.
          float legThickness = footRadius * 0.35;
          float leftLeg = segmentDistance(head, leftFoot, target) - legThickness;
          float rightLeg = segmentDistance(head, rightFoot, target) - legThickness;

          // Rounded feet at the ends of the lines, kept large enough to stay
          // visible even when the leg is short and the head nearly reaches them.
          float footRender = footRadius * 0.7;
          float leftFootDistance = circleDistance(leftFoot, footRender, target);
          float rightFootDistance = circleDistance(rightFoot, footRender, target);

          float body = min(
            headDistance,
            min(min(leftLeg, rightLeg), min(leftFootDistance, rightFootDistance))
          );

          // Real eyes painted on the leading face — a bright white sclera with a
          // dark pupil — rather than carved holes, so the character reads as
          // alive instead of hollow-socketed.
          // Big white sclera, small pupil: the eye must read as mostly white so
          // it looks like an eye, not a dark socket. (An 8-bit albedo caps the
          // sclera at pure white, so its area — not its colour — is what makes
          // the eye read brighter against the body.)
          vec2 eyeBase = head + forward * (renderRadius * 0.26);
          vec2 leftEyeCenter = eyeBase + perp * (renderRadius * 0.38);
          vec2 rightEyeCenter = eyeBase - perp * (renderRadius * 0.38);
          float scleraRadius = renderRadius * 0.26;
          float pupilRadius = renderRadius * 0.11;

          // The pupil slides toward the gaze target (the cursor for the local
          // player, otherwise the travel direction), kept well inside the rim so
          // a generous ring of white always frames it. The normalize is guarded
          // so a cursor resting exactly on an eye can't produce NaNs.
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

          // Soften each eye edge by at least one screen texel so the colour
          // boundary antialiases instead of staircasing when the character is
          // small on screen. The fixed world-space term sets a floor on the
          // softness when zoomed in; fwidth widens the band to a texel as the
          // head shrinks. Computed here in uniform control flow — NOT inside the
          // body branch below — so the screen-space derivatives stay defined.
          // fwidth needs WebGL2 derivatives (core in GLSL ES 3.00), so the
          // WebGL1 fallback keeps the plain world-space band.
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
            // Brief white punch when taking a hit.
            color = mix(
              readFromPalette(characterColors[i]),
              vec4(1.0),
              clamp(characterFlash[i], 0.0, 1.0)
            );

            // Paint the eyes over the body colour. The sclera albedo is HDR
            // (>> 1): the shading pass multiplies it by the (often dim, reddish)
            // scene light before clamping to the screen, so an over-bright white
            // reads as a clean white eye everywhere instead of dimming into a
            // dark socket. Needs the float colour buffer in sdf-2d; on 8-bit
            // fallback it simply clamps back to plain white. The smoothstep
            // widths (scleraAa / pupilAa, computed above) antialias the colour
            // boundary in a zoom-aware way.
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

  // 0..1 transient white flash on taking a hit. Set per frame.
  public hitFlash = 0;
  // World point the eyes look at; the pupils slide toward it. Set per frame
  // (the cursor for the local player, the travel direction for everyone else).
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
