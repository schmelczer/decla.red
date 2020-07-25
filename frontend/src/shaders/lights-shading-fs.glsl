#version 300 es

precision mediump float;

#define INFINITY 10000.0
#define LIGHT_COUNT 3
#define AMBIENT_LIGHT vec3(0.05)
#define LIGHT_DROP 800.0
#define SHADOW_BIAS 0.01

struct Light {
    vec2 center;
  	float radius;
    vec3 value;
}[LIGHT_COUNT] lights;

uniform sampler2D distanceTexture;
uniform mat3 worldToDistanceUV;
uniform vec2 cursorPosition;
uniform vec2 viewBoxSize;

float square(in float a) {
    return a*a;
}

float getDistance(in vec2 target, out vec3 color) {
    // should avoid this matrix multiplication
    vec2 targetUV = (vec3(target.xy, 1.0) * worldToDistanceUV).xy;

    vec4 values = texture(distanceTexture, targetUV);
    color = values.rgb;
    return  values.w * 32.0;
}

float getDistance(in vec2 target) {
    // should avoid this matrix multiplication
    vec2 targetUV = (vec3(target.xy, 1.0) * worldToDistanceUV).xy;

    vec4 values = texture(distanceTexture, targetUV);
    return values.w * 32.0;
}

void createWorld() {
    //lights[0] = Light(vec2(600, 700), 40.5, normalize(vec3(1.0)) * 2.0);
    //lights[1] = Light(vec2(100.0, 350.0), 52.5, normalize(vec3(2.0, 1.0, 0.25)) * 0.5);
    lights[2] = Light(cursorPosition, 52.5, normalize(vec3(0.93, 0.25, 0.5)) * 1.0);
}

float getFractionOfLightArriving(
    in vec2 target, 
    in vec2 direction, 
    in float startingDistance,
    in float lightDistance, 
    in float lightRadius
) {
    float q = INFINITY;
    float rayLength = 0.0;

    float movingAverageMeanDistance = startingDistance;

    for (int j = 0; j < 64; j++) {
        float minDistance = getDistance(target + direction * rayLength);
        movingAverageMeanDistance = movingAverageMeanDistance / 2.0 + minDistance / 2.0;
        q = min(q, movingAverageMeanDistance / rayLength);
        rayLength = min(lightDistance, rayLength + max(0.0001, minDistance));
    }
    return smoothstep(0.0, 1.0, (q - SHADOW_BIAS) * (lightDistance + lightRadius) / lightRadius);
}

vec3 getPixelColor(in vec2 worldCoordinates, in vec2 uvCoordinates) {
    vec3 colorAtPosition;
    float startingDistance = getDistance(worldCoordinates, colorAtPosition);

    vec3 result = colorAtPosition * AMBIENT_LIGHT;
    
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = lights[i];
        
        float lightDistance = distance(worldCoordinates, light.center) - light.radius;
        vec3 lightColorAtPosition = light.value / square(max(0.0, lightDistance / LIGHT_DROP) + 1.0);
        vec2 lightDirection = normalize(light.center - worldCoordinates);

        float fractionOfLightArriving = getFractionOfLightArriving(
            worldCoordinates, lightDirection, startingDistance, 
            max(0.0, lightDistance), light.radius
        );

        result += colorAtPosition * lightColorAtPosition * fractionOfLightArriving;
    }
    
    return clamp(result, 0.0, 1.0);
}


in vec2 worldCoordinates;
in vec2 uvCoordinates;
out vec4 fragmentColor;

void main() {
    createWorld();

    fragmentColor = vec4(getPixelColor(worldCoordinates, uvCoordinates), 1.0);
}
