#version 300 es

precision mediump float;

#define LIGHT_COUNT {lightCount}

uniform mat3 ndcToWorld;
in vec4 a_position;
out vec2 worldCoordinates;
out vec2 uvCoordinates;


uniform struct Light {
    vec2 center;
  	float radius;
    vec3 value;
}[LIGHT_COUNT] lights;

out vec2[LIGHT_COUNT] directions;

void main() {
    worldCoordinates = (vec3(a_position.xy, 1.0) * ndcToWorld).xy;
    uvCoordinates = ((a_position.xy + vec2(1.0)) / 2.0).xy;

    for (int i = 0; i < LIGHT_COUNT; i++) {
        directions[i] = lights[i].center - worldCoordinates;
    }

    gl_Position = a_position;
}
