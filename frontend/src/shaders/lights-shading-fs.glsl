#version 300 es

precision mediump float;

#define INFINITY 10000.0

#define LIGHTS_SIZE 3

#define LIGHT_PENETRATION 0.95
#define ANTIALIASING_RADIUS 1.0

struct Light {
    vec2 center;
  	float radius;
    vec3 color;
    float intensity;
};

uniform sampler2D distanceTexture;
uniform mat3 worldToDistanceUV;
uniform mat3 lightingScreenToWorld;
uniform vec2 cursorPosition;


Light lights[LIGHTS_SIZE];

float circleDistance(in vec2 position, in Light circle)
{
	return length(position - circle.center) - circle.radius;
}

float getDistance(in vec2 target, out vec3 color) {
    vec2 targetUV = (vec3(target.xy, 1.0) * worldToDistanceUV).xy;
    vec4 values = texture(distanceTexture, targetUV);
    color = values.rgb;
    return (values.a - 0.5) * 256.0;
}

void createWorld() {
    lights[0] = Light(vec2(600, 700), 40.5, vec3(1.0), 25.0);
    lights[1] = Light(vec2(100.0, 350.0), 52.5,vec3(2.0, 1.0, 0.25), 20.5);
    lights[2] = Light(cursorPosition, 52.5,vec3(0.63, 0.07, 0.19), 200.5);
}

float escapeFromObject(inout vec2 position, in vec2 direction) {
    float fractionOfLightPenetrating = 1.0;
    float rayLength = 0.0;
    for (int i = 0; i < 64; i++) {
        vec3 color;
        float minDistance = getDistance(position, color);
        if (minDistance >= 0.0) {
            return fractionOfLightPenetrating;
        }
        
        fractionOfLightPenetrating *= pow(LIGHT_PENETRATION, -minDistance);
        rayLength += max(1.0, -minDistance);
        position += direction * rayLength;
    }
    
    return 0.0;
}

float getFractionOfLightArriving(in vec2 position, in vec2 direction, in float lightDistance, in float lightRadius) {
    float fractionOfLightArriving = 1.0;
    vec3 color;

    float rayLength = 0.0;
    for (int j = 0; j < 64; j++) {
        float minDistance = getDistance(position + direction * rayLength, color);
        fractionOfLightArriving = min(fractionOfLightArriving, minDistance / rayLength);
        rayLength += max(1.0, abs(minDistance));

        if (rayLength > lightDistance) {
            fractionOfLightArriving = (fractionOfLightArriving * lightDistance + lightRadius) / (2.0 * lightRadius);
            return smoothstep(0.0, 1.0, fractionOfLightArriving);
        }
    }
    
    return 0.0;
}

vec3 getPixelColor(in vec2 targetLighting, in bool startsInside, in vec3 colorBias) {
    vec3 result = vec3(0.0);
    
    for (int i = 0; i < LIGHTS_SIZE; i++) {
        Light light = lights[i];
        
        float lightDistance = circleDistance(targetLighting, light);
        vec3 lightColor = normalize(light.color) * light.intensity 
                         / mix(1.0, lightDistance, clamp(lightDistance, 0.0, 1.0));

        if (lightDistance < 0.0) {
            return lightColor;
        }       
        
        vec2 lightDirection = normalize(light.center - targetLighting);
        vec2 rayStart = targetLighting;
        
        
        float fractionOfLightPenetrating = 1.0;
        if (startsInside) {
            fractionOfLightPenetrating = escapeFromObject(rayStart, lightDirection);
            lightColor *= colorBias;
    	}

        float fractionOfLightArriving = getFractionOfLightArriving(rayStart, lightDirection, lightDistance, light.radius);
        result += lightColor * fractionOfLightArriving * fractionOfLightPenetrating;
    }
    
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

out vec4 fragmentColor;


void main() {
    createWorld();

    vec2 pixelWorldCoordinates = (vec3(gl_FragCoord.xy, 1.0) * lightingScreenToWorld).xy;

    vec3 color;
    float minDistance = getDistance(pixelWorldCoordinates, color);
    color = getPixelColor(pixelWorldCoordinates, minDistance < 0.0, minDistance < 0.0 ? color : vec3(1.0));
    
    fragmentColor = vec4(color, 1.0);

    if (distance(cursorPosition, pixelWorldCoordinates) < 50.0) {
        fragmentColor = vec4(vec3(1.0, 1.0, 0.0), 1.0);
    }
}
