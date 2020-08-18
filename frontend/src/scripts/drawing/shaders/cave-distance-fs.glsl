#version 300 es

precision mediump float;

#define LINE_COUNT {lineCount}
#define BLOB_COUNT {blobCount}
 
uniform float maxMinDistance; 

#if LINE_COUNT > 0
    uniform struct Line {
        vec2 from;
        vec2 toFromDelta;
        float fromRadius;
        float toRadius;
    }[LINE_COUNT] lines;

    void lineMinDistance(vec2 worldCoordinates, inout float minDistance) {
        minDistance = maxMinDistance;

        for (int i = 0; i < LINE_COUNT; i++) {
            vec2 targetFromDelta = worldCoordinates - lines[i].from;
            vec2 toFromDelta = lines[i].toFromDelta;
            
            float h = clamp(
                dot(targetFromDelta, toFromDelta) / dot(toFromDelta, toFromDelta),
                0.0, 1.0
            );

            float lineDistance = (
                    distance(targetFromDelta, toFromDelta * h) 
                - mix(lines[i].fromRadius, lines[i].toRadius, h)
            );

            minDistance = min(minDistance, lineDistance);
        }

        minDistance *= -1.0;
    }
#endif

#if BLOB_COUNT > 0
    #define headRadius {headRadius}
    #define torsoRadius {torsoRadius}
    #define footRadius {footRadius}

    uniform struct Blob {
        vec2 headCenter;
        vec2 torsoCenter;
        vec2 leftFootCenter;
        vec2 rightFootCenter;
    }[BLOB_COUNT] blobs;

    float circleMinDistance(vec2 worldCoordinates, vec2 circleCenter, float radius) {
        return distance(worldCoordinates, circleCenter) - radius;
    }

    void blobMinDistance(vec2 worldCoordinates, inout float minDistance) {
        float k = 1.0;

        for (int i = 0; i < BLOB_COUNT; i++) {
            float res = exp2(-k * circleMinDistance(worldCoordinates, blobs[i].headCenter, headRadius));
            res += exp2(-k * circleMinDistance(worldCoordinates, blobs[i].torsoCenter, torsoRadius));
            res += exp2(-k * circleMinDistance(worldCoordinates, blobs[i].leftFootCenter, footRadius));
            res += exp2(-k * circleMinDistance(worldCoordinates, blobs[i].rightFootCenter, footRadius));

            minDistance = min(minDistance, -log2(res) / k);
        }
    }
#endif



in vec2 worldCoordinates;
out vec2 fragmentColor;

void main() {
    float minDistance = -maxMinDistance;

    #if LINE_COUNT > 0
        lineMinDistance(worldCoordinates, minDistance);
    #endif

    #if BLOB_COUNT > 0
        blobMinDistance(worldCoordinates, minDistance);
    #endif

    fragmentColor = vec2(minDistance, 0.0);
}
