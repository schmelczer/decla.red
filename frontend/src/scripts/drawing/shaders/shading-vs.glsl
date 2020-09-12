#version 300 es

precision lowp float;

#define CIRCLE_LIGHT_COUNT {circleLightCount}
#define POINT_LIGHT_COUNT {pointLightCount}

uniform mat3 modelTransform;
in vec4 vertexPosition;

out vec2 position;
out vec2 uvCoordinates;

uniform vec2 squareToAspectRatio;

#if CIRCLE_LIGHT_COUNT > 0
    uniform struct {
        vec2 center;
        float radius;
        vec3 value;
    }[CIRCLE_LIGHT_COUNT] circleLights;

    out vec2[CIRCLE_LIGHT_COUNT] circleLightDirections;
#endif

#if POINT_LIGHT_COUNT > 0
    uniform struct {
        vec2 center;
        float radius;
        vec3 value;
    }[POINT_LIGHT_COUNT] pointLights;

    out vec2[POINT_LIGHT_COUNT] pointLightDirections;
#endif

void main() {
    vec3 vertexPosition2D = vec3(vertexPosition.xy, 1.0) * modelTransform;
    gl_Position = vec4(vertexPosition2D.xy, 0.0, 1.0);
    position = vertexPosition2D.xy * squareToAspectRatio;

    uvCoordinates = (vertexPosition2D * mat3(
        0.5, 0.0, 0.5,
        0.0, 0.5, 0.5,
        0.0, 0.0, 1.0
    )).xy;

    #if CIRCLE_LIGHT_COUNT > 0
        for (int i = 0; i < CIRCLE_LIGHT_COUNT; i++) {
            circleLightDirections[i] = circleLights[i].center - position;
        }
    #endif

    #if POINT_LIGHT_COUNT > 0
        for (int i = 0; i < POINT_LIGHT_COUNT; i++) {
            pointLightDirections[i] = pointLights[i].center - position;
        }
    #endif
}
