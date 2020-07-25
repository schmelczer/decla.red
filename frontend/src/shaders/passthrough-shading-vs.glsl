#version 300 es

uniform mat3 ndcToWorld;
in vec4 a_position;
out vec2 worldCoordinates;
out vec2 uvCoordinates;

void main() {
    worldCoordinates = (vec3(a_position.xy, 1.0) * ndcToWorld).xy;
    uvCoordinates = ((a_position.xy + vec2(1.0)) / 2.0).xy;
    gl_Position = a_position;
}
