#version 300 es

precision mediump float;

#define LINES_ENABLED {linesEnabled}
#define LINE_COUNT {lineCount}
#define CAVE_COLOR vec3(0.36, 0.38, 0.76)
#define AIR_COLOR vec3(0.7)
#define DISTANCE_SCALE {distanceScale}
 
uniform float maxMinDistance; 

#if LINES_ENABLED
    // start, end - start
    uniform vec2[LINE_COUNT * 2] lines;
    // startRadius, endRadois
    uniform float[LINE_COUNT * 2] radii;
#endif

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    #if LINES_ENABLED
        float minDistance = maxMinDistance;

        for (int i = 0; i < LINE_COUNT; i++) {
            vec2 pa = worldCoordinates - lines[2 * i];
            vec2 ba = lines[2 * i + 1];
            float baLength = length(ba);
            // todo: do we really want this dot(pa / baLength, ba / baLength)
            float h = clamp(dot(pa / baLength, ba / baLength), 0.0, 1.0);
            float lineDistance = distance(pa, ba * h) - mix(radii[2 * i], radii[2 * i + 1], h);

            minDistance = min(minDistance, lineDistance);
        }

        float distance = -minDistance;
        fragmentColor = vec4(
            mix(CAVE_COLOR, AIR_COLOR, clamp(distance, -10.0, 0.0) / 10.0 + 1.0),
            distance / DISTANCE_SCALE
        );
    #else

        fragmentColor = vec4(AIR_COLOR, maxMinDistance / DISTANCE_SCALE);
    #endif
}
