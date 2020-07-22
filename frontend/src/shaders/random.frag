#version 300 es

precision mediump float;

const float inf = 1000000.0;
const float pi = atan(1.0) * 4.0;

float interpolate(float from, float to, float quotient) {
    float steppedQ = sin(quotient * pi - pi * 0.5) * 0.5 + 0.5;
    return from + (to - from) * clamp(steppedQ, 0.0, 1.0);
}


float noise(float x){
    return fract(sin(x) * 43758.5453123);
}

float terrain(float x) {
    float result = 0.0;

    float frequency = 0.01;
    float amplitude = 1.0;

    for (int i = 0; i < 8; i++) {
        result += sin(2.0 * pi * x * frequency - 2.0 * pi * noise(float(i) * 200.0)) * amplitude;
        frequency *= 1.5;
        amplitude /= 1.2;
    }

    return result;
}

vec2 random2(vec2 st){
    st = vec2( dot(st,vec2(127.1,311.7)),
              dot(st,vec2(269.5,183.3)) );
    return -1.0 + 2.0*fract(sin(st)*43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    vec2 u = f*f*(3.0-2.0*f);

    return mix( mix( dot( random2(i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                     dot( random2(i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                mix( dot( random2(i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                     dot( random2(i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
}