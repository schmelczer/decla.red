#version 300 es

precision mediump float;

#define INFINITY 200.0
#define LINE_COUNT {lineCount}
#define CAVE_COLOR vec3(0.36, 0.38, 0.76)
#define AIR_COLOR vec3(0.7)

// start, end - start
uniform vec2[LINE_COUNT * 2] lines;
// startRadius, endRadois
uniform float[LINE_COUNT * 2] radii;

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    float minDistance = INFINITY;

    for (int i = 0; i < LINE_COUNT; i++) {
        vec2 pa = worldCoordinates - lines[2 * i];
        vec2 ba = lines[2 * i + 1];
        float baLength = length(ba);
        float h = clamp(dot(pa / baLength, ba / baLength), 0.0, 1.0);
        float lineDistance = distance(pa, ba * h) - mix(radii[2 * i], radii[2 * i + 1], h);

        minDistance = min(minDistance, lineDistance);
    }

    float distance = -minDistance;
    fragmentColor = vec4(
        mix(CAVE_COLOR, AIR_COLOR, clamp(distance, -10.0, 0.0) / 10.0 + 1.0),
        distance / 32.0
    );
}
