#version 300 es

precision mediump float;

#define LIGHT_COUNT {lightCount}

uniform mat3 modelTransform;
uniform mat3 ndcToUv;
uniform mat3 uvToWorld;

in vec4 vertexPosition;

out vec2 worldCoordinates;
out vec2 uvCoordinates;

#if LIGHT_COUNT > 0
    uniform struct Light {
        vec2 center;
        float radius;
        vec3 value;
    }[LIGHT_COUNT] lights;

    out vec2[LIGHT_COUNT] directions;
#endif

void main() {
    vec3 vertexPosition2D = vec3(vertexPosition.xy, 1.0) * modelTransform;
    vec3 uvCoordinates1 = vertexPosition2D * ndcToUv;
    worldCoordinates = (uvCoordinates1 * uvToWorld).xy;
    uvCoordinates = (uvCoordinates1).xy;

    #if LIGHT_COUNT > 0
        for (int i = 0; i < LIGHT_COUNT; i++) {
            directions[i] = lights[i].center - worldCoordinates;
        }
    #endif

    gl_Position = vec4(vertexPosition2D.xy, 0.0, 1.0);
}
