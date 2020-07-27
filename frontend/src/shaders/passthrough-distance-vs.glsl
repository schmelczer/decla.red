#version 300 es

precision mediump float;

uniform mat3 modelTransform;
uniform mat3 uvToWorld;
uniform mat3 ndcToUv;

in vec4 vertexPosition;
out vec2 worldCoordinates;

void main() {
    vec3 vertexPosition2D = vec3(vertexPosition.xy, 1.0) * modelTransform;
    worldCoordinates = (vertexPosition2D * ndcToUv * uvToWorld).xy;
    gl_Position = vec4(vertexPosition2D.xy, 0.0, 1.0);
}
