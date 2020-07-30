#version 300 es

precision mediump float;

#define LINE_COUNT {lineCount}
#define CAVE_COLOR vec3(0.36, 0.38, 0.76)
#define AIR_COLOR vec3(0.7)
#define DISTANCE_SCALE {distanceScale}
#define EDGE_SMOOTHING {edgeSmoothing}
 
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
    #if LINE_COUNT > 0
        float minDistance = maxMinDistance;

        for (int i = 0; i < LINE_COUNT; i++) {
            Line line = lines[i];
            vec2 pa = worldCoordinates - line.from;
            vec2 ba = line.toFromDelta;
            float baLength = length(ba);
            // todo: do we really want this dot(pa / baLength, ba / baLength)
            float h = clamp(dot(pa / baLength, ba / baLength), 0.0, 1.0);
            float lineDistance = distance(pa, ba * h) - mix(line.fromRadius, line.toRadius, h);

            minDistance = min(minDistance, lineDistance);
        }

        float distance = -minDistance;
        fragmentColor = vec4(
            mix(CAVE_COLOR, AIR_COLOR, clamp(distance, -EDGE_SMOOTHING, 0.0) / EDGE_SMOOTHING + 1.0),
            distance / DISTANCE_SCALE
        );
    #else

        fragmentColor = vec4(AIR_COLOR, maxMinDistance / DISTANCE_SCALE);
    #endif
}
