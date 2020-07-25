#version 300 es

precision mediump float;

#define INFINITY 200.0
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
    float baLength = length(ba);
    float h = clamp(dot(pa / baLength, ba / baLength), 0.0, 1.0);
    return length(pa - ba * h) - mix(radiusFrom, radiusTo, h);
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

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    float distance = getDistance(worldCoordinates);
    const vec3 caveColor = vec3(0.0);
    const vec3 airColor = vec3(1.0);
    fragmentColor = vec4(
        mix(caveColor, airColor, distance),
        distance / 32.0
    );
}
