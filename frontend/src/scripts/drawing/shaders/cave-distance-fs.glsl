#version 300 es

precision mediump float;

#define LINE_COUNT {lineCount}
#define CAVE_COLOR vec3(0.36, 0.38, 0.76)
#define AIR_COLOR vec3(0.7)
#define DISTANCE_SCALE {distanceScale}
#define DISTANCE_OFFSET {distanceOffset}
 
uniform float maxMinDistance; 

#if LINE_COUNT > 0
    uniform struct Line {
        vec2 from;
        vec2 toFromDelta;
        float fromRadius;
        float toRadius;
    }[LINE_COUNT] lines;
#endif

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    float realDistance = 0.0;

    #if LINE_COUNT > 0
        float minDistance = maxMinDistance;

        for (int i = 0; i < LINE_COUNT; i++) {
            vec2 targetFromDelta = worldCoordinates - lines[i].from;
            vec2 toFromDelta = lines[i].toFromDelta;
            float h = clamp(dot(targetFromDelta, toFromDelta) / dot(toFromDelta, toFromDelta), 0.0, 1.0);
            float lineDistance = distance(targetFromDelta, toFromDelta * h) - mix(lines[i].fromRadius, lines[i].toRadius, h);

            minDistance = min(minDistance, lineDistance);
        }

        realDistance = -minDistance;
    #endif

    fragmentColor = vec4(
        mix(CAVE_COLOR, AIR_COLOR, clamp(realDistance, 0.0, 1.0)),
        (realDistance + DISTANCE_OFFSET) / DISTANCE_SCALE

    );
}
