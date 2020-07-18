#version 300 es

precision mediump float;


#define INFINITY 1.0 / 0.0
#define WORLD_SIZE 4
#define N (20)

#define CIRCLE 1
#define LINE 2
#define TRIANGLE 3

out vec4 fragmentColor;
uniform vec2 resolution;
uniform float time;


struct Material {
    vec3 color;
};

struct Primitive {
    uint type;
    uint index;
};

struct Object {
    Material material;
    Primitive[10] primitives;
};

struct Circle {
    uint parent;
    vec2 center;
  	float radius;
};

struct Line {
    uint parent;
    vec2 a;
  	vec2 b;
};

struct Triangle {
    uint parent;
    vec2 a;
  	vec2 b;
  	vec2 c;
};

// uniform Object[100] objects;

Circle[3] circles;
Line[1] lines;
Triangle[1] triangles;

float triangleDistance(in vec2 position, in Triangle triangle)
{
    vec2 e0 = triangle.b - triangle.a, e1 = triangle.c - triangle.b, e2 = triangle.a - triangle.c;
    vec2 v0 = position - triangle.a, v1 = position - triangle.b, v2 = position - triangle.c;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x*e2.y - e0.y*e2.x);
    vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                     vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                     vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
    return -sqrt(d.x)*sign(d.y);
} 

float lineDistance(in vec2 position, in Line line)
{
    vec2 pa = position - line.a, ba = line.b - line.a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba*h);
}

float circleDistance(in vec2 position, in Circle circle)
{
	return length(position - circle.center) - circle.radius;
}

float getDistance(in vec2 target, out uint nearestParentIndex) {
    float distance = INFINITY;

    for (int i = 0; i < circles.length(); i++) {
        float distanceToCurrent = circleDistance(target, circles[i]);
        if (distanceToCurrent < distance) {
            distance = distanceToCurrent;
            nearestParentIndex = circles[i].parent;
        }
    }

    for (int i = 0; i < lines.length(); i++) {
        float distanceToCurrent = lineDistance(target, lines[i]);
        if (distanceToCurrent < distance) {
            distance = distanceToCurrent;
            nearestParentIndex = lines[i].parent;
        }
    }

    for (int i = 0; i < triangles.length(); i++) {
        float distanceToCurrent = triangleDistance(target, triangles[i]);
        if (distanceToCurrent < distance) {
            distance = distanceToCurrent;
            nearestParentIndex = triangles[i].parent;
        }
    }

    return distance;
}

void createWorld() {
    circles[0] = Circle(0u, vec2(250.0, 100.0), 12.5);   
    circles[1] = Circle(0u, vec2(150.0, 50.0), 32.5);
    circles[2] = Circle(0u, vec2(300.0, 350.0), 52.5);

    lines[0] = Line(0u, vec2(100.0, 300.0), vec2(550.0, 140.0));

    triangles[0] = Triangle(0u, vec2(400.0, 100.0), vec2(200.0, 240.0), vec2(600.0, 340.0));
}

float linearstep(float a, float b, float q) {
    return a + clamp((b - a) * q, 0.0, 1.0);
}

void main() {
    createWorld();
    
    vec2 position = gl_FragCoord.xy + vec2(0.5);
    uint index;
    vec3 color = vec3(1.0) * linearstep(0.0, 1.0, getDistance(position, index));
    fragmentColor = vec4(color, 1.0);
}
