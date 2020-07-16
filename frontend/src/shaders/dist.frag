#version 300 es

precision mediump float;


#define INFINITY 10000000.0

#define WORLD_SIZE 4

#define N (20)

out vec4 fragmentColor;

uniform vec2 resolution;
// uniform vec2 u_mouse;
uniform float time;

struct Circle {
    vec2 center;
  	float radius;
    vec3 color;
};

Circle world[WORLD_SIZE];

vec3 red = vec3(5.0, 0.0, 2.0);
vec3 blue = vec3(0.0, 0.0, 3.0);

float sdPolygon( in vec2[N] v, in vec2 p )
{
    float d = dot(p-v[0],p-v[0]);
    float s = 1.0;
    const int num = v.length();
    for( int i=0, j=num-1; i<N; j=i, i++ )
    {
        vec2 e = v[j] - v[i];
        vec2 w = p - v[i];
        vec2 b = w - e*clamp( dot(w,e)/dot(e,e), 0.0, 1.0 );
        d = min( d, dot(b,b) );
        bvec3 c = bvec3(p.y>=v[i].y,p.y<v[j].y,e.x*w.y>e.y*w.x);
        if( all(c) || all(not(c)) ) s*=-1.0;  
    }
    return s*sqrt(d);
}

float circleDistance(in vec2 position, in Circle circle)
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
    world[0] = Circle(vec2(250.0, 100.0), 12.5, blue);   
    world[1] = Circle(vec2(150.0, 50.0), 32.5, red);
    world[2] = Circle(vec2(300.0, 350.0), 52.5, blue);
}

float linearstep(float a, float b, float q) {
    return a + clamp((b - a) * q, 0.0, 1.0);
}

void main() {
    createWorld();
    
    vec2 position = gl_FragCoord.xy + vec2(0.5);
    
    vec3 color = vec3(1.0) * linearstep(0.0, 1.0, getDistance(position));
    fragmentColor = vec4(color, 1.0);
}
