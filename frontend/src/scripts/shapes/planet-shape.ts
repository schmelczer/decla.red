import { mat2d, vec2, vec3, vec4 } from 'gl-matrix';
import { PolygonFactory, DrawableDescriptor, Drawable } from 'sdf-2d';
import { settings } from 'shared';

export const colorToString = (v: vec3 | vec4): string =>
  `vec4(${v[0]}, ${v[1]}, ${v[2]}, ${v.length > 3 ? v[3] : 1})`;

export class PlanetShape extends PolygonFactory(settings.planetEdgeCount, 0) {
  public static descriptor: DrawableDescriptor = {
    sdf: {
      shader: `
          uniform vec2 planetVertices[PLANET_COUNT * ${settings.planetEdgeCount}];
          uniform vec2 planetCenters[PLANET_COUNT];
          uniform float planetLengths[PLANET_COUNT];
          uniform float planetRandoms[PLANET_COUNT];
          uniform float planetColorMixQ[PLANET_COUNT];

          uniform sampler2D noiseTexture;

          #ifdef WEBGL2_IS_AVAILABLE
            float planetTerrain(vec2 h) {
              return texture(noiseTexture, h)[0] - 0.5;
            }
          #else
            float planetTerrain(vec2 h) {
              return texture2D(noiseTexture, h)[0] - 0.5;
            }
          #endif

          vec2 planetLineDistance(vec2 target, vec2 from, vec2 to) {
            vec2 targetFromDelta = target - from;
            vec2 toFromDelta = to - from;
            float h = clamp(
              dot(targetFromDelta, toFromDelta) / dot(toFromDelta, toFromDelta),
              0.0, 1.0
            );

            vec2 diff = targetFromDelta - toFromDelta * h;
            return vec2(
              dot(diff, diff),
              toFromDelta.x * targetFromDelta.y - toFromDelta.y * targetFromDelta.x
            );
          }

          float planetMinDistance(vec2 target, out vec4 color) {
            float minDistance = 100.0;

            for (int j = 0; j < PLANET_COUNT; j++) {
              vec2 startEnd = planetVertices[j * ${settings.planetEdgeCount}];
              vec2 vb = startEnd;

              vec2 center = planetCenters[j];
              float l = planetLengths[j];
              float randomOffset = planetRandoms[j];
              vec2 targetCenterDelta = target - center;
              float targetDistance = length(targetCenterDelta);
              vec2 targetTangent = targetCenterDelta / clamp(targetDistance, 0.01, 1000.0);
              vec2 noisyTarget = target - (
                targetTangent * planetTerrain(vec2(
                  l * abs(atan(targetTangent.y, targetTangent.x)),
                  randomOffset
                )) / 12.0
              );
            
              float d = 10000.0;
              float s = 1.0;
              for (int k = 1; k < ${settings.planetEdgeCount}; k++) {
                vec2 va = vb;
                vb = planetVertices[j * ${settings.planetEdgeCount} + k];
                vec2 ds = planetLineDistance(noisyTarget, va, vb);

                bvec3 cond = bvec3(noisyTarget.y >= va.y, noisyTarget.y < vb.y, ds.y > 0.0);
                if (all(cond) || all(not(cond))) {
                  s *= -1.0;
                }

                d = min(d, ds.x);
              }

              vec2 ds = planetLineDistance(noisyTarget, vb, startEnd);
              bvec3 cond = bvec3(noisyTarget.y >= vb.y, noisyTarget.y < startEnd.y, ds.y > 0.0);
              if (all(cond) || all(not(cond))) {
                s *= -1.0;
              }

              d = min(d, ds.x);
              float dist = s * sqrt(d);

              if (dist < minDistance) {
                minDistance = dist;
                color = mix(${colorToString(settings.declaPlanetColor)}, ${colorToString(
        settings.redPlanetColor,
      )}, planetColorMixQ[j]);
              }
            }

            return minDistance;
          }
        `,
      distanceFunctionName: 'planetMinDistance',
    },
    propertyUniformMapping: {
      length: 'planetLengths',
      random: 'planetRandoms',
      center: 'planetCenters',
      vertices: 'planetVertices',
      colorMixQ: 'planetColorMixQ',
    },
    uniformCountMacroName: `PLANET_COUNT`,
    shaderCombinationSteps: [0, 1, 2, 3],
    empty: new PlanetShape(new Array(settings.planetEdgeCount).fill(vec2.create()), 0),
  };

  public randomOffset = 0;

  constructor(public vertices: Array<vec2>, public colorMixQ: number) {
    super(vertices);
  }

  protected getObjectToSerialize(transform2d: mat2d, _: number): any {
    const transformedVertices = (this as any).actualVertices.map((v: vec2) =>
      vec2.transformMat2d(vec2.create(), v, transform2d),
    );

    const center = transformedVertices.reduce(
      (sum: vec2, v: vec2) => vec2.add(sum, sum, v),
      vec2.create(),
    );
    vec2.scale(center, center, 1 / transformedVertices.length);

    let length = 0;
    for (let i = 1; i < this.vertices.length; i++) {
      length += vec2.distance(transformedVertices[i - 1], transformedVertices[i]);
    }

    return {
      vertices: transformedVertices,
      center,
      length,
      random: this.randomOffset,
      colorMixQ: this.colorMixQ,
    };
  }

  public serializeToUniforms(
    uniforms: any,
    transform2d: mat2d,
    transform1d: number,
  ): void {
    const { propertyUniformMapping } = (this.constructor as typeof Drawable).descriptor;

    const serialized = this.getObjectToSerialize(transform2d, transform1d);
    Object.entries(propertyUniformMapping).forEach(([k, v]) => {
      if (!Object.prototype.hasOwnProperty.call(uniforms, v)) {
        uniforms[v] = [];
      }

      if (k === 'vertices') {
        uniforms[v].push(...serialized[k]);
      } else {
        uniforms[v].push(serialized[k]);
      }
    });
  }
}
