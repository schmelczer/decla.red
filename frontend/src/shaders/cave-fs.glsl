#version 300 es

precision mediump float;

const float smoothing = 10.0;
const float inf = 1000000.0;
const float pi = 3.141592654;

float interpolate(float from, float to, float quotient) {
    float steppedQ = sin(quotient * pi - pi * 0.5) * 0.5 + 0.5;
    return from + (to - from) * clamp(steppedQ, 0.0, 1.0);
}

vec2 rotate90deg(in vec2 vector) {
    return vec2(-vector.y, vector.x);
}

struct Line {
    vec2 from;
  	vec2 to;
    vec2 normal;
    bool isLineEnd;
}[16] lines;

float lineDistance(in vec2 position, in Line line, out float h) {
    vec2 pa = position - line.from, ba = line.to - line.from;
    h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 delta = pa - ba*h;
    // sign can return 0, double sign prevents this 
    float side = sign(sign(dot(delta, line.normal)) - 0.5);
    return length(delta) * side;
}

Line endDummyLineFromLine(Line line) {
    return Line(line.to, line.to + rotate90deg(line.normal), line.normal, false);
}

float getDistance(in vec2 target) {
    float minDistance = inf;

    float leftJoinAcuteness = 0.0;
    vec2 splitterLineNormalStart = vec2(-1.0, 0.0);
    bool skipDistanceToPrevious = true;
    for (int i = 0; i < lines.length(); i++) {
        Line current = lines[i];

        Line next;
        if (current.isLineEnd || i + 1 == lines.length()) {
            next = endDummyLineFromLine(current);
        } else {
            next = lines[i + 1];
        }

        vec2 splitterLineNormalEnd = rotate90deg(normalize(current.normal + next.normal));

        float h;
        float distanceToCurrent = lineDistance(target, current, h);
        float rightJoinAcuteness = dot(next.to - current.from, next.normal - current.normal);
        distanceToCurrent -= interpolate(
            sign(leftJoinAcuteness) * smoothing,
            sign(rightJoinAcuteness) * smoothing, h
        );
        leftJoinAcuteness = rightJoinAcuteness;

        if (
            !(
                   dot(target - current.from, splitterLineNormalStart * -sign(dot(current.to - current.from, splitterLineNormalStart))) > 0.0 
                || dot(target - current.to, splitterLineNormalEnd * sign(dot(current.from - current.to, splitterLineNormalEnd))) <= 0.0
            ) && abs(distanceToCurrent) < abs(minDistance)
        ) {
            minDistance = distanceToCurrent;
        }
        splitterLineNormalStart = splitterLineNormalEnd;
    }

    return minDistance;
}

void createWorld() {
    lines[0] = Line(vec2(0.0, 300.0), vec2(550.0, 140.0), vec2(1.0), false);
    lines[1] = Line(vec2(550.0, 140.0), vec2(750.0, 130.0), vec2(1.0), false);
    lines[2] = Line(vec2(750.0, 130.0), vec2(650.0, 230.0), vec2(1.0), false);
    lines[3] = Line(vec2(650.0, 230.0), vec2(850.0, 230.0), vec2(1.0), false);
    lines[4] = Line(vec2(850.0, 230.0), vec2(800.0, 150.0), vec2(1.0), false);
    lines[5] = Line(vec2(800.0, 150.0), vec2(1000.0, 120.0), vec2(1.0), false);
    lines[6] = Line(vec2(1000.0, 120.0), vec2(1150, 120.0), vec2(1.0), false);
    lines[7] = Line(vec2(1150, 120.0), vec2(10200, 350.0), vec2(1.0), true);
    lines[8] = Line(vec2(0.0, 600.0), vec2(550.0, 440.0), vec2(-1.0), false);
    lines[9] = Line(vec2(550.0, 440.0), vec2(750.0, 430.0), vec2(-1.0), false);
    lines[10] = Line(vec2(750.0, 430.0), vec2(650.0, 530.0), vec2(-1.0), false);
    lines[11] = Line(vec2(650.0, 530.0), vec2(850.0, 530.0), vec2(-1.0), false);
    lines[12] = Line(vec2(850.0, 530.0), vec2(820.0, 450.0), vec2(-1.0), false);
    lines[13] = Line(vec2(820.0, 450.0), vec2(1000.0, 420.0), vec2(-1.0), false);
    lines[14] = Line(vec2(1000.0, 420.0), vec2(1150, 420.0), vec2(-1.0), false);
    lines[15] = Line(vec2(1150, 420.0), vec2(10200, 650.0), vec2(-1.0), true);

    for (int i = 0; i < lines.length(); i++) {
        vec2 tangent = lines[i].to - lines[i].from;
        lines[i].normal = normalize(
            vec2(-lines[i].normal.x * tangent.y, lines[i].normal.x * tangent.x)
        );
    }
}

uniform mat3 transform;
out vec4 fragmentColor;

void main() {
    createWorld();

    vec3 projectiveXY = vec3(gl_FragCoord.xy, 1.0);
    vec2 position = (projectiveXY * transform).xy;
    //fragmentColor = getDistance(position) > 0.0 ? vec4(0.0, 0.0, 0.0, 0.0) : vec4(0.0, 0.0, 0.0, 1.0);
    fragmentColor = vec4(vec3(1.0) * clamp(0.0, 1.0, getDistance(position)), 1.0);
}
