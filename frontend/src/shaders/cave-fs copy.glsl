#version 300 es

precision mediump float;

#define SMOOTHING 10.0
#define INFINITY 10000.0;
#define LINE_COUNT 100


float interpolate(float from, float to, float quotient) {
    return from + (to - from) * smoothstep(0.0, 1.0, quotient);
}

vec2 rotate90deg(in vec2 vector) {
    return vec2(-vector.y, vector.x);
}

uniform struct Line {
    vec2 from;
  	vec2 to;
    vec2 normal;
    bool isLineEnd;
}[LINE_COUNT] lines;

float lineDistance(in vec2 position, in Line line, out float h) {
    vec2 pa = position - line.from, ba = line.to - line.from;
    h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 delta = pa - ba*h;
    // sign can return 0, double sign prevents this 
    float side = sign(sign(dot(delta, line.normal)) - 0.5);
    return length(delta) * side;
}

float getDistance(in vec2 target) {
    float positiveMinDistance = INFINITY;
    float negativeMaxDistance = INFINITY;

    float leftJoinAcuteness = 0.0;
    vec2 splitterLineNormalStart = vec2(-1.0, 0.0);
    for (int i = 0; i < LINE_COUNT - 1; i++) {
        vec2 splitterLineNormalEnd = rotate90deg(normalize(lines[i].normal + lines[i + 1].normal));

        float h;
        float distanceToCurrent = lineDistance(target, lines[i], h);
        float rightJoinAcuteness = dot(lines[i + 1].to - lines[i].from, lines[i + 1].normal - lines[i].normal);
        distanceToCurrent -= interpolate(
            sign(leftJoinAcuteness) * SMOOTHING,
            sign(rightJoinAcuteness) * SMOOTHING, h
        );
        leftJoinAcuteness = rightJoinAcuteness;

        if (
            !(
                   dot(target - lines[i].from, splitterLineNormalStart * -sign(dot(lines[i].to - lines[i].from, splitterLineNormalStart))) > 0.0 
                || dot(target - lines[i].to, splitterLineNormalEnd * sign(dot(lines[i].from - lines[i].to, splitterLineNormalEnd))) <= 0.0
            )
        ) {
            float distanceToCurrentSign = sign(distanceToCurrent) / 2.0;
            positiveMinDistance = min(positiveMinDistance, 1.0 / (0.5 + distanceToCurrentSign) * abs(distanceToCurrent));
            negativeMaxDistance = min(negativeMaxDistance, 1.0 / (0.5 - distanceToCurrentSign) * abs(distanceToCurrent));
        }
        splitterLineNormalStart = splitterLineNormalEnd;
    }

    return positiveMinDistance < negativeMaxDistance ? positiveMinDistance : -negativeMaxDistance;
}

uniform mat3 transform;
out vec4 fragmentColor;

void main() {
    vec2 position = (vec3(gl_FragCoord.xy, 1.0) * transform).xy;
    fragmentColor = vec4(vec3(1.0) * clamp(0.0, 1.0, getDistance(position)), 1.0);
    
}
