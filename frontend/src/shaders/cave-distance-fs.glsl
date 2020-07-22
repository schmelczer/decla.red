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

uniform mat3 transform;
out vec4 fragmentColor;

void main() {
    vec2 position = (vec3(gl_FragCoord.xy, 1.0) * transform).xy;
    float distance = getDistance(position);
    fragmentColor = vec4(vec3(0.0), distance / 256.0 + 0.5);
}
