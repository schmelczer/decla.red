#version 300 es

precision mediump float;

#define INFINITY 1000.0
#define LIGHT_DROP 500.0
#define MIN_STEP 1.0
#define AMBIENT_LIGHT vec3(0.15)

#define CIRCLE_LIGHT_COUNT {circleLightCount}
#define POINT_LIGHT_COUNT {pointLightCount}
#define DISTANCE_SCALE {distanceScale}
#define DISTANCE_OFFSET {distanceOffset}
#define EDGE_SMOOTHING {edgeSmoothing}

uniform sampler2D distanceTexture;
uniform vec2 viewBoxSize;

float getDistance(in vec2 target, out vec3 color) {
    vec4 values = texture(distanceTexture, target);
    color = values.rgb;
    return (values.w - DISTANCE_OFFSET) * DISTANCE_SCALE;
}

float getDistance(in vec2 target) {
    return (texture(distanceTexture, target).w - DISTANCE_OFFSET) * DISTANCE_SCALE;
}

#if CIRCLE_LIGHT_COUNT > 0
    uniform struct CircleLight {
        vec2 center;
        float radius;
        vec3 value;
    }[CIRCLE_LIGHT_COUNT] circleLights;

    in vec2[CIRCLE_LIGHT_COUNT] circleLightDirections;
#endif

#if POINT_LIGHT_COUNT > 0
    uniform struct PointLight {
        vec2 center;
        float radius;
        vec3 value;
    }[POINT_LIGHT_COUNT] pointLights;

    in vec2[POINT_LIGHT_COUNT] pointLightDirections;
#endif

in vec2 worldCoordinates;
in vec2 uvCoordinates;
out vec4 fragmentColor;

void main() {
    vec3 colorAtPosition;
    float startingDistance = getDistance(uvCoordinates, colorAtPosition);
    vec3 lighting = AMBIENT_LIGHT;

    #if CIRCLE_LIGHT_COUNT > 0
        for (int i = 0; i < CIRCLE_LIGHT_COUNT; i++) {
            float lightCenterDistance = distance(circleLights[i].center, worldCoordinates);

            /*if (lightCenterDistance < circleLights[i].radius) {
                lighting = vec3(1.0, 1.0, 0.0);
            }*/

            vec3 lightColorAtPosition = circleLights[i].value / pow(
                lightCenterDistance / LIGHT_DROP + 1.0, 2.0
            );

            float q = INFINITY;
            float rayLength = startingDistance;
            float exponentialDecayDistance = rayLength;
            vec2 direction = normalize(circleLightDirections[i]) / viewBoxSize;

            for (int j = 0; j < 48; j++) {
                if (rayLength > lightCenterDistance) {
                    lighting += lightColorAtPosition * clamp(
                        q / circleLights[i].radius * (lightCenterDistance + 1.0), 0.0, 1.0
                    ) * step(circleLights[i].radius, getDistance(
                        uvCoordinates + direction * lightCenterDistance
                    ));
                    break;
                }

                float minDistance = getDistance(uvCoordinates + direction * rayLength);
                exponentialDecayDistance = (exponentialDecayDistance + minDistance) / 2.0;
                q = min(q, exponentialDecayDistance / rayLength);
                rayLength += max(MIN_STEP, minDistance);
            }
        }
    #endif

    #if POINT_LIGHT_COUNT > 0
        for (int i = 0; i < POINT_LIGHT_COUNT; i++) {
            float lightDistance = distance(pointLights[i].center, worldCoordinates);

            vec3 lightColorAtPosition = mix(
                pointLights[i].value, 
                vec3(0.0), 
                sqrt(clamp(lightDistance / pointLights[i].radius, 0.0, 1.0))
            );

        
            float q = INFINITY;
            float rayLength = startingDistance;
            float exponentialDecayDistance = startingDistance;
            vec2 direction = normalize(pointLightDirections[i]) / viewBoxSize;

            for (int j = 0; j < 48; j++) {
                if (rayLength > lightDistance) {
                    lighting += lightColorAtPosition * step(0.0, q);
                    break;
                }

                float minDistance = getDistance(uvCoordinates + direction * rayLength);
                exponentialDecayDistance = (exponentialDecayDistance + minDistance) / 2.0;
                q = min(q, exponentialDecayDistance);
                rayLength += max(MIN_STEP, minDistance);
            }
        }
    #endif

    fragmentColor = vec4(colorAtPosition * lighting * clamp(startingDistance, 0.0, 1.0), 1.0);
}
