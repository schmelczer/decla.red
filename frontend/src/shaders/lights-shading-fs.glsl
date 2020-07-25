#version 300 es

precision mediump float;

#define INFINITY 10000.0
#define LIGHT_COUNT 5
#define AMBIENT_LIGHT vec3(0.15)
#define LIGHT_DROP 800.0
#define SHADOW_BIAS 0.01

uniform struct Light {
    vec2 center;
  	float radius;
    vec3 value;
}[LIGHT_COUNT] lights;

uniform sampler2D distanceTexture;
uniform vec2 viewBoxSize;

float square(in float a) {
    return a*a;
}

float getDistance(in vec2 target, out vec3 color) {
    vec4 values = texture(distanceTexture, target);
    color = values.rgb;
    return  values.w * 32.0;
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

    for (int j = 0; j < 64; j++) {
        float minDistance = getDistance(target + direction * rayLength);
        movingAverageMeanDistance = movingAverageMeanDistance / 2.0 + minDistance / 2.0;
        q = min(q, movingAverageMeanDistance / rayLength);
        rayLength = min(lightDistance, rayLength + max(1.0, minDistance));
    }

    return smoothstep(0.0, 1.0, (q - SHADOW_BIAS) * (lightDistance + lightRadius) / lightRadius);
}

vec3 getPixelColor(in vec2 worldCoordinates, in vec2 uvCoordinates) {
    vec3 colorAtPosition;
    float startingDistance = getDistance(uvCoordinates, colorAtPosition);

    vec3 result = colorAtPosition * AMBIENT_LIGHT;
    
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = lights[i];
        
        float lightDistance = distance(worldCoordinates, light.center) - light.radius;
        vec3 lightColorAtPosition = light.value / square(max(0.0, lightDistance / LIGHT_DROP) + 1.0);
        vec2 lightDirection = normalize(light.center - worldCoordinates);

        float fractionOfLightArriving = getFractionOfLightArriving(
            uvCoordinates, lightDirection, startingDistance, 
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
    fragmentColor = vec4(getPixelColor(worldCoordinates, uvCoordinates), 1.0);
}
