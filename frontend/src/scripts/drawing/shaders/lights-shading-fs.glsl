#version 300 es

precision mediump float;

#define INFINITY 1000.0
#define LIGHT_DROP 500.0
#define AMBIENT_LIGHT vec3(0.15)

#define CIRCLE_LIGHT_COUNT {circleLightCount}
#define POINT_LIGHT_COUNT {pointLightCount}
#define EDGE_SMOOTHING {edgeSmoothing}

uniform sampler2D distanceTexture;
uniform vec2 viewBoxSize;

vec3[4] colors = vec3[4](
    vec3(0.5),
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 1.0, 0.0),
    vec3(0.0, 0.0, 1.0)
);

float getDistance(in vec2 target, out vec3 color) {
    vec4 values = texture(distanceTexture, target);
    color = colors[int(values[1])];
    return values[0];
}

float getDistance(in vec2 target) {
    return texture(distanceTexture, target)[0];
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
            float lightCenterDistance = distance(
                circleLights[i].center, 
                worldCoordinates
            );
            float lightDistance = lightCenterDistance - circleLights[i].radius;

            /*if (lightDistance < 0.0) {
                lighting = vec3(1.0, 1.0, 0.0);
            }*/

            vec3 lightColorAtPosition = circleLights[i].value / pow(
                lightDistance / LIGHT_DROP + 1.0, 2.0
            );

            float q = INFINITY;
            float rayLength = startingDistance;
            vec2 direction = normalize(circleLightDirections[i]) / viewBoxSize;

            for (int j = 0; j < 48; j++) {
                if (rayLength >= lightDistance) {
                    lighting += lightColorAtPosition * clamp(
                        q / circleLights[i].radius * lightCenterDistance, 0.0, 1.0
                    );
                    break;
                }

                float minDistance = getDistance(uvCoordinates + direction * rayLength);
                q = min(q, minDistance / rayLength);
                rayLength += minDistance;
            }
        }
    #endif

    #if POINT_LIGHT_COUNT > 0
        /*for (int i = 0; i < POINT_LIGHT_COUNT; i++) {
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
                rayLength += minDistance;
            }
        }*/
    #endif

    fragmentColor = vec4(
        colorAtPosition * lighting * step(0.0, startingDistance),
        1.0
    );
}
