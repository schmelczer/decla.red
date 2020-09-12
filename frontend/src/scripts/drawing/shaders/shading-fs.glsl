#version 300 es

precision lowp float;

#define INFINITY 1000.0
#define LIGHT_DROP 4.0
#define AMBIENT_LIGHT vec3(0.3)

#define CIRCLE_LIGHT_COUNT {circleLightCount}
#define POINT_LIGHT_COUNT {pointLightCount}

uniform bool softShadowsEnabled;

#define AIR_COLOR vec3(0.5)

uniform sampler2D distanceTexture;

vec3[3] colors = vec3[](
    vec3(0.1, 0.05, 0.1),
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
    uniform struct {
        vec2 center;
        float radius;
        vec3 value;
    }[CIRCLE_LIGHT_COUNT] circleLights;

    in vec2[CIRCLE_LIGHT_COUNT] circleLightDirections;
#endif

#if POINT_LIGHT_COUNT > 0
    uniform struct {
        vec2 center;
        float radius;
        vec3 value;
    }[POINT_LIGHT_COUNT] pointLights;

    in vec2[POINT_LIGHT_COUNT] pointLightDirections;
#endif

in vec2 position;
in vec2 uvCoordinates;
uniform vec2 squareToAspectRatioTimes2;

out vec4 fragmentColor;

void main() {
    vec3 colorAtPosition;
    float startingDistance = getDistance(uvCoordinates, colorAtPosition);
    if (startingDistance < 0.0) {
        fragmentColor = vec4(colorAtPosition, 1.0);
        return;
    }

    colorAtPosition = AIR_COLOR;

    vec3 lighting = AMBIENT_LIGHT;

    #if CIRCLE_LIGHT_COUNT > 0
        for (int i = 0; i < CIRCLE_LIGHT_COUNT; i++) {
            float lightCenterDistance = distance(circleLights[i].center, position);
            float lightDistance = lightCenterDistance - circleLights[i].radius;

            vec3 lightColorAtPosition = circleLights[i].value / pow(
                lightDistance / LIGHT_DROP + 1.0, 2.0
            );

            vec2 targetDirection = vec2(-1.0, 0.0);
            vec2 originalDirection = normalize(circleLightDirections[i]);
            vec2 direction = originalDirection / squareToAspectRatioTimes2;

            lightColorAtPosition *= pow(max(0.0, dot(targetDirection, originalDirection)), 10.0);

            float rayLength = startingDistance;

            if (softShadowsEnabled) {
                float q = INFINITY;
                for (int j = 0; j < 96; j++) {
                    if (rayLength >= lightDistance) {
                        lighting += lightColorAtPosition * clamp(
                            (q * 2.0) / circleLights[i].radius * lightCenterDistance, 0.0, 1.0
                        ) * step(0.0, startingDistance);
                        break;
                    }

                    float minDistance = getDistance(uvCoordinates + direction * rayLength);
                    q = min(q, minDistance / rayLength);

                    rayLength += minDistance / 2.0;
                }
            } else {
                for (int j = 0; j < 32; j++) {
                    rayLength += getDistance(uvCoordinates + direction * rayLength);
                }
                if (rayLength >= lightCenterDistance) {
                    lighting += lightColorAtPosition * step(0.0, startingDistance);
                }
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
    
    fragmentColor = vec4(colorAtPosition * lighting, 1.0);
}
