#version 300 es

precision mediump float;


#define INFINITY 10000.0
#define LINE_COUNT 50


uniform vec2[LINE_COUNT * 2] lines;
uniform float[LINE_COUNT * 2] radii;

float lineDistance(
    in vec2 target, 
    in vec2 start, 
    in vec2 end, 
    in float radiusFrom, 
    in float radiusTo
) {
    vec2 pa = target - start, ba = end - start;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return distance(pa, ba * h) - mix(radiusFrom, radiusTo, smoothstep(0.0, 1.0, h));
}

float getDistance(in vec2 target) {
    float minDistance = INFINITY;

    for (int i = 0; i < LINE_COUNT; i++) {
        vec2 start = lines[2 * i];
        vec2 end = lines[2 * i + 1];
        float rFrom = radii[2 * i];
        float rTo = radii[2 * i + 1];
        minDistance = min(minDistance, lineDistance(target, start, end, rFrom, rTo));
    }

    return -minDistance;
}

vec3 branchlessTernary(float condition, vec3 ifPositive, vec3 ifNegative) {
    float isPositive = (sign(condition) + 1.0) * 0.5;
    return ifPositive * abs(isPositive) + ifNegative * (1.0 - isPositive);
}

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    float distance = getDistance(worldCoordinates);
    fragmentColor = vec4(
        branchlessTernary(distance, vec3(1.0), vec3(0.0, 1.0, 0.5)),
        distance / 128.0 + 0.5
    );
}
