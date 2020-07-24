#version 300 es

precision mediump float;

#define INFINITY 10000.0
#define LIGHT_COUNT 3
#define LIGHT_PENETRATION 1000.0
#define ANTIALIASING_RADIUS 1.0
#define AMBIENT_LIGHT vec3(0.075)

struct Light {
    vec2 center;
  	float radius;
    vec3 value;
};

uniform sampler2D distanceTexture;
uniform mat3 worldToDistanceUV;
uniform vec2 cursorPosition;

Light lights[LIGHT_COUNT];

float getDistance(in vec2 target, out vec3 color) {
    // should avoid this matrix multiplication
    vec2 targetUV = (vec3(target.xy, 1.0) * worldToDistanceUV).xy;

    vec4 values = texture(distanceTexture, targetUV);
    color = values.rgb;
    return (values.a - 0.5) * 128.0;
}

float getDistance(in vec2 target) {
    // should avoid this matrix multiplication
    vec2 targetUV = (vec3(target.xy, 1.0) * worldToDistanceUV).xy;

    vec4 values = texture(distanceTexture, targetUV);
    return (values.a - 0.5) * 128.0;
}

void createWorld() {
    lights[0] = Light(vec2(600, 700), 40.5, normalize(vec3(1.0)) * 2.0);
    lights[1] = Light(vec2(100.0, 350.0), 52.5, normalize(vec3(2.0, 1.0, 0.25)) * 0.5);
    lights[2] = Light(cursorPosition, 52.5, normalize(vec3(0.63, 0.25, 0.5)) * 1.0);
}

float getFractionOfLightArriving(
    in vec2 target, 
    in vec2 direction, 
    in float lightDistance, 
    in float lightRadius
) {
    float q = INFINITY;
    float rayLength = 0.0;

    for (int j = 0; j < 64; j++) {
        float minDistance = getDistance(target + direction * rayLength);
        q = min(q, minDistance / rayLength);
        rayLength = min(lightDistance, rayLength + max(1.0, minDistance));
    }
    return smoothstep(0.0, 1.0, q * (lightDistance + lightRadius) / lightRadius);
}

float square(in float a) {
    return a*a;
}

vec3 getPixelColor(in vec2 worldCoordinates) {
    vec3 result = vec3(0.0);

    vec3 colorAtPosition;
    float startingDistance = getDistance(worldCoordinates, colorAtPosition);
    float fractionOfLightPenetrating = smoothstep(0.0, 1.0, 
        1.0 - (min(0.0, startingDistance) / LIGHT_PENETRATION)
    );
    
    for (int i = 0; i < LIGHT_COUNT; i++) {
        Light light = lights[i];
        
        float lightDistance = distance(worldCoordinates, light.center) - light.radius;
        vec3 lightColorAtPosition = light.value / square(max(0.0, lightDistance / 200.0) + 1.0);
        vec2 lightDirection = normalize(light.center - worldCoordinates);

        float fractionOfLightArriving = getFractionOfLightArriving(
            worldCoordinates, lightDirection, max(0.0, lightDistance), light.radius
        );

        result += colorAtPosition * lightColorAtPosition * fractionOfLightArriving * fractionOfLightPenetrating;
    }

    // Add ambient light
    result += colorAtPosition * AMBIENT_LIGHT;
    
    return clamp(result, 0.0, 1.0);
}

/*vec3 getPixelColorAntialiased(in vec2 position) {
    Circle nearest;
    float minDistance = getDistance(position, nearest);
    if (0.0 < minDistance && minDistance < 1.0) {
		vec2 closerDirection = normalize(nearest.center - position);
        return mix(getPixelColor(position + closerDirection, true, nearest.color), getPixelColor(position - closerDirection, false, nearest.color), minDistance);
    }
    
    return getPixelColor(position, minDistance < 0.0, minDistance < 0.0 ? nearest.color : vec3(1.0));
}*/

in vec2 worldCoordinates;
out vec4 fragmentColor;

void main() {
    createWorld();
    // log2 for compenstaion?
    fragmentColor = vec4(getPixelColor(worldCoordinates), 1.0);
}
