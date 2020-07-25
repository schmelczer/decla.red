#version 300 es

precision mediump float;

#define INFINITY 1000.0
#define LIGHT_COUNT 8
#define AMBIENT_LIGHT vec3(0.15)
#define LIGHT_DROP 400.0

uniform struct Light {
    vec2 center;
  	float radius;
    vec3 value;
}[LIGHT_COUNT] lights;

uniform sampler2D distanceTexture;
uniform vec2 viewBoxSize;


float getDistance(in vec2 target, out vec3 color) {
    vec4 values = texture(distanceTexture, target);
    color = values.rgb;
    return values.w * 32.0;
}

float getDistance(in vec2 target) {
    return texture(distanceTexture, target).w * 32.0;
}

float getFractionOfLightArriving(
    in vec2 target, 
    in vec2 direction, 
    in float startingDistance,
    in float lightDistance, 
    in float lightRadius
) {
    float q = 1.0;
    float rayLength = startingDistance;
    float movingAverageMeanDistance = startingDistance;

    direction /= viewBoxSize;

    for (int j = 0; j < 48; j++) {
        float minDistance = getDistance(target + direction * rayLength);
        movingAverageMeanDistance = movingAverageMeanDistance / 2.0 + minDistance / 2.0;
        q = min(q, movingAverageMeanDistance / rayLength);
        rayLength = min(lightDistance, rayLength + max(5.0, minDistance));
    }

    return clamp(q * (lightDistance + lightRadius) / lightRadius, 0.0, 1.0);
}

vec3 getPixelColor(in vec2 worldCoordinates, in vec2 uvCoordinates) {
    vec3 colorAtPosition;
    float startingDistance = getDistance(uvCoordinates, colorAtPosition);

    vec3 result = colorAtPosition * AMBIENT_LIGHT;
    
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = lights[i];
        
        vec2 lightDelta = light.center - worldCoordinates;
        float lightDistance = length(lightDelta);
        vec2 lightDirection = lightDelta / lightDistance;

        float r = lightDistance / LIGHT_DROP + 1.0;
        vec3 lightColorAtPosition = light.value / (r * r);

        float fractionOfLightArriving = getFractionOfLightArriving(
            uvCoordinates, lightDirection, startingDistance, 
            lightDistance, light.radius
        );

        result += colorAtPosition * lightColorAtPosition * fractionOfLightArriving;
    }
    
    return result;
}

in vec2 worldCoordinates;
in vec2 uvCoordinates;
out vec4 fragmentColor;

void main() {
    fragmentColor = vec4(getPixelColor(worldCoordinates, uvCoordinates), 1.0);
}
