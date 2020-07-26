#version 300 es

precision mediump float;

uniform mat3 ndcToWorld;
in vec4 a_position;
out vec2 worldCoordinates;

void main() {
    worldCoordinates = (vec3(a_position.xy, 1.0) * ndcToWorld).xy;
    gl_Position = a_position;
}
