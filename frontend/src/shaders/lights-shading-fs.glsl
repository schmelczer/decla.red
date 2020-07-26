#version 300 es

precision mediump float;

#define INFINITY 1000.0
#define AMBIENT_LIGHT vec3(0.15)
#define LIGHT_DROP 400.0
#define MIN_STEP 3.0
#define EDGE_SMOOTHING 5.0
#define LIGHT_COUNT {lightCount}
#define DISTANCE_SCALE {distanceScale}

uniform struct Light {
    vec2 center;
  	float radius;
    vec3 value;
}[LIGHT_COUNT] lights;

uniform sampler2D distanceTexture;
uniform vec2 viewBoxSize;

in vec2[LIGHT_COUNT] directions;

float getDistance(in vec2 target, out vec3 color) {
    vec4 values = texture(distanceTexture, target);
    color = values.rgb;
    return values.w * DISTANCE_SCALE;
}

float getDistance(in vec2 target) {
    return texture(distanceTexture, target).w * DISTANCE_SCALE;
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

    for (int j = 0; j < 32; j++) {
        float minDistance = getDistance(target + direction * rayLength);
        movingAverageMeanDistance = movingAverageMeanDistance / 2.0 + minDistance / 2.0;
        q = min(q, movingAverageMeanDistance / rayLength);
        rayLength = min(lightDistance, rayLength + max(MIN_STEP, minDistance));
    }

    return clamp(q * (lightDistance + lightRadius) / lightRadius, 0.0, 1.0);
}

in vec2 worldCoordinates;
in vec2 uvCoordinates;
out vec4 fragmentColor;

void main() {
    vec3 colorAtPosition;
    float startingDistance = getDistance(uvCoordinates, colorAtPosition);

    vec3 ligthing = vec3(0.0);
    
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = lights[i];
        float lightDistance = distance(light.center, worldCoordinates);

        float r = (lightDistance + light.radius) / LIGHT_DROP + 1.0;
        vec3 lightColorAtPosition = light.value / (r * r);

        float fractionOfLightArriving = getFractionOfLightArriving(
            uvCoordinates, normalize(directions[i]), startingDistance, 
            lightDistance, light.radius
        );

        ligthing += lightColorAtPosition * fractionOfLightArriving;
    }

    fragmentColor = vec4(
        colorAtPosition * (AMBIENT_LIGHT + 
        step(EDGE_SMOOTHING / 2.0, clamp(startingDistance, 0.0, EDGE_SMOOTHING)) * ligthing),
        1.0
    );
}
