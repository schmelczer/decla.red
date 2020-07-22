#version 300 es

precision mediump float;


vec3 rainbow(float level) {
	float r = float(level <= 2.0) + float(level > 4.0) * 0.5;
	float g = max(1.0 - abs(level - 2.0) * 0.5, 0.0);
	float b = (1.0 - (level - 4.0) * 0.5) * float(level >= 4.0);
	return vec3(r, g, b);
}

vec4 smoothRainbow(float x) {
    float level1 = floor(x*6.0);
    float level2 = min(6.0, floor(x*6.0) + 1.0);
    
    vec3 a = rainbow(level1);
    vec3 b = rainbow(level2);
    
    return vec4(mix(a, b, fract(x*6.0)), 1.0);
}


uniform sampler2D distanceTexture;
uniform mat3 transformUV;
out vec4 fragmentColor;

void main() {
    vec2 position = (vec3(gl_FragCoord.xy, 1.0) * transformUV).xy;
    vec4 previous = texture(distanceTexture, position);
    //fragmentColor = smoothRainbow(previous.a);
    fragmentColor = previous.a > 0.5 ? vec4(1.0, 1.0, 1.0, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
}
