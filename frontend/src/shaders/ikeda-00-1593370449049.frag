#version 300 es

#ifdef GL_ES
precision mediump float;
#endif

#define INFINITY 1.0 / 0.0

#define WORLD_SIZE 4
#define LIGHTS_SIZE 2

#define LIGHT_PENETRATION 0.95
#define ANTIALIASING_RADIUS 1.0

uniform vec2 resolution;
// uniform vec2 u_mouse;
uniform float time;

struct Light {
    vec2 center;
  	float radius;
    vec3 color;
    float intensity;
};

struct Circle {
    vec2 center;
  	float radius;
    vec3 color;
};

Light lights[LIGHTS_SIZE];
Circle world[WORLD_SIZE];

vec3 red = vec3(5.0, 0.0, 2.0);
vec3 blue = vec3(0.0, 0.0, 3.0);

float circleDistance(in vec2 position, in Circle circle)
{
	return length(position - circle.center) - circle.radius;
}

float circleDistance(in vec2 position, in Light circle)
{
	return length(position - circle.center) - circle.radius;
}

float getDistance(in vec2 target) {
    float distance = INFINITY;
    for (int i = 0; i < WORLD_SIZE; i++) {
        distance = min(distance, circleDistance(target, world[i]));
    }
    return distance;
}

float getDistance(in vec2 target, out Circle nearest) {
    float distance = INFINITY;
    for (int i = 0; i < WORLD_SIZE; i++) {
        float distanceToCurrent = circleDistance(target, world[i]);
        if (distanceToCurrent < distance) {
            distance = distanceToCurrent;
            nearest = world[i];
        }
    }
    return distance;
}

void createWorld() {
    lights[0] = Light(u_mouse, 40.5, vec3(1.0), 25.0);
    lights[1] = Light(vec2(100.0, 350.0), 52.5,vec3(2.0, 1.0, 0.25), 20.5);
    
    world[0] = Circle(vec2(250.0, 100.0), 12.5, blue);   
    world[1] = Circle(vec2(150.0, 50.0), 32.5, red);
    world[2] = Circle(vec2(300.0, 350.0), 52.5, blue);
}

float escapeFromObject(inout vec2 position, in vec2 direction) {
    float fractionOfLightPenetrating = 1.0;
    float rayLength = 0.0;
    for (int i = 0; i < 64; i++) {
        float minDistance = getDistance(position);
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

    float rayLength = 0.0;
    for (int j = 0; j < 64; j++) {
        float minDistance = getDistance(position + direction * rayLength);
        fractionOfLightArriving = min(fractionOfLightArriving, minDistance / rayLength);
        rayLength += max(1.0, abs(minDistance));

        if (rayLength > lightDistance) {
            fractionOfLightArriving = (fractionOfLightArriving * lightDistance + lightRadius) / (2.0 * lightRadius);
            return smoothstep(0.0, 1.0, fractionOfLightArriving);
        }
    }
    
    return 0.0;
}

vec3 getPixelColor(in vec2 position, in bool startsInside, in vec3 colorBias) {
    vec3 result = vec3(0.0);
    
    for (int i = 0; i < LIGHTS_SIZE; i++) {
        Light light = lights[i];
        
        float lightDistance = circleDistance(position, light);
        vec3 lightColor = normalize(light.color) * light.intensity / mix(1.0,  lightDistance, clamp(lightDistance, 0.0, 1.0));
        if (lightDistance < 0.0) {
            return lightColor;
        }       
        
        vec2 lightDirection = normalize(light.center - position);
        vec2 rayStart = position;
        
        
        float fractionOfLightPenetrating = 1.0;
        if (startsInside) {
            fractionOfLightPenetrating =  escapeFromObject(rayStart, lightDirection);
            lightColor *= colorBias;
    	}

        float fractionOfLightArriving = getFractionOfLightArriving(rayStart, lightDirection, lightDistance, light.radius);
        result += lightColor * fractionOfLightArriving * fractionOfLightPenetrating;
    }
    
    return clamp(result, 0.0, 1.0);
}

vec3 getPixelColorAntialiased(in vec2 position) {
    Circle nearest;
    float minDistance = getDistance(position, nearest);
    if (0.0 < minDistance && minDistance < 1.0) {
		vec2 closerDirection = normalize(nearest.center - position);
        return mix(getPixelColor(position + closerDirection, true, nearest.color), getPixelColor(position - closerDirection, false, nearest.color), minDistance);
    }
    
    return getPixelColor(position, minDistance < 0.0, minDistance < 0.0 ? nearest.color : vec3(1.0));
}

void main() {
    createWorld();
    
    vec2 position = gl_FragCoord.xy + vec2(0.5);
	vec3 color = getPixelColorAntialiased(position);
    
    gl_FragColor = vec4(color, 1.0);
}
