#version 300 es

precision mediump float;

#define CIRCLE_LIGHT_COUNT {circleLightCount}
#define POINT_LIGHT_COUNT {pointLightCount}

uniform mat3 modelTransform;
uniform mat3 cameraTransform;
uniform mat3 ndcToUv;
uniform mat3 uvToWorld;

in vec4 vertexPosition;

out vec2 worldCoordinates;
out vec2 uvCoordinates;

#if CIRCLE_LIGHT_COUNT > 0
    uniform struct CircleLight {
        vec2 center;
        float radius;
        vec3 value;
    }[CIRCLE_LIGHT_COUNT] circleLights;

    out vec2[CIRCLE_LIGHT_COUNT] circleLightDirections;
#endif

#if POINT_LIGHT_COUNT > 0
    uniform struct PointLight {
        vec2 center;
        float radius;
        vec3 value;
    }[POINT_LIGHT_COUNT] pointLights;

    out vec2[POINT_LIGHT_COUNT] pointLightDirections;
#endif

void main() {
    vec3 vertexPosition2D = vec3(vertexPosition.xy, 1.0) * modelTransform;
    vec3 uvCoordinates1 = vertexPosition2D * ndcToUv;
    worldCoordinates = (uvCoordinates1 * uvToWorld).xy;
    uvCoordinates = (uvCoordinates1).xy;

    #if CIRCLE_LIGHT_COUNT > 0
        for (int i = 0; i < CIRCLE_LIGHT_COUNT; i++) {
            circleLightDirections[i] = circleLights[i].center - worldCoordinates;
        }
    #endif

    #if POINT_LIGHT_COUNT > 0
        for (int i = 0; i < POINT_LIGHT_COUNT; i++) {
            pointLightDirections[i] = pointLights[i].center - worldCoordinates;
        }
    #endif

    gl_Position = vec4(vertexPosition2D.xy, 0.0, 1.0);
}
