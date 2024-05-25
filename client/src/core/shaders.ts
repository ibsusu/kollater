export const header = `
attribute float vertexId;

uniform vec2 mouse;
uniform vec2 resolution;
uniform vec4 background;
uniform float time;
uniform float vertexCount;
uniform sampler2D volume;
uniform sampler2D sound;
// uniform sampler2D floatSound;
uniform sampler2D touch;
uniform vec2 soundRes;
uniform float _dontUseDirectly_pointSize;

varying vec4 v_color;
`;
 
export const mainRE = /(void[ \t\n\r]+main[ \t\n\r]*\([ \t\n\r]*\)[ \t\n\r]\{)/g;

export function applyTemplateToShader(src: string) {
  let vsrc = header + src;
  vsrc = vsrc.replace(mainRE, function(m) {
    return m + "gl_PointSize=1.0;";
  });
  var lastBraceNdx = vsrc.lastIndexOf("}");
  if (lastBraceNdx >= 0) {
    var before = vsrc.slice(0, lastBraceNdx);
    var after = vsrc.slice(lastBraceNdx);
    vsrc = before + ";gl_PointSize = max(0., gl_PointSize*_dontUseDirectly_pointSize);" + after;
  }
  return vsrc;
}

export const particleVertexShader = /* glsl */ `
    attribute vec3 position;
    attribute vec4 random;

    uniform mat4 modelMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uTime;

    varying vec4 vRandom;

    void main() {
        vRandom = random;

        // positions are 0->1, so make -1->1
        vec3 pos = position * 2.0 - 1.0;

        // Scale towards camera to be more interesting
        pos.z *= 10.0;

        // modelMatrix is one of the automatically attached uniforms when using the Mesh class
        vec4 mPos = modelMatrix * vec4(pos, 1.0);

        // add some movement in world space
        float t = uTime * 0.6;
        mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 10., random.x);
        mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 10., random.w);
        mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

        // get the model view position so that we can scale the points off into the distance
        vec4 mvPos = viewMatrix * mPos;
        gl_PointSize = 300.0 / length(mvPos.xyz) * (random.x + 0.1);
        gl_Position = projectionMatrix * mvPos;
    }
`;

export const particleFragmentShader =`
precision highp float;

uniform float uTime;

varying vec4 vRandom;

void main() {
    vec2 uv = gl_PointCoord.xy;

    float circle = smoothstep(0.5, 0.4, length(uv - 0.5)) * 0.8;

    gl_FragColor.rgb = 0.8 + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28) + vec3(0.1, 0.0, 0.3);
    gl_FragColor.a = circle;
}`;

export const basicVertexShader =`
  // in vec3 position;
  // in vec2 uv;

  // uniform mat4 modelViewMatrix;
  // uniform mat4 projectionMatrix;
  // uniform float rotation;

  // out vec2 vUv;
  // out float vRotation;

  void main() {
    // vRotation = rotation;
    // vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

const eyeShader = `
#define PI radians(180.)
#define NUM_SEGMENTS 2.0
#define NUM_POINTS (NUM_SEGMENTS * 2.0)
#define STEP 1.0

float radius = 0.15;
float amount = 100.;
float len = vertexCount / amount;

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

void main() {
  float ratio = resolution.x / resolution.y;
  float seg = floor(vertexId/len);
  float segId = mod(vertexId,len);
  float v = texture2D(volume, vec2(1., (1.+seg)/amount*240.)).a;
  float s = texture2D(sound, vec2(1., (1.+segId)/len*240.)).a;
  // float s = texture2D(floatSound, vec2(1., (1.+segId)/len*240.)).a;
  vec3 p = vec3(vertexId * 0.005, seg, time*0.1 - segId*0.001);
  float n = noise(p);
  float x = cos(vertexId/vertexCount * PI * 2.)*(v*radius+segId*0.001);
  float y = sin(vertexId/vertexCount * PI * 2.)*ratio*(v*radius+segId*0.0001);
  float z = 0.0;
  
  float sideStep = step(1.0, mod(segId, 2.0)); // Returns 1.0 if segId is odd, 0.0 if even
  x += (.4 + cos(n * PI * 4.0) * segId * 0.000002 * s) * (1.0 - sideStep); // Applies when segId is even
  x += (-.4 + sin(n * PI * 3.0) * segId * 0.000003 * s) * sideStep; // Applies when segId is odd
  y += (.3 + sin(n * PI*4.) * segId * 0.0000015 * s * ratio);
  z += cos(n * PI * 4.0) * segId * 0.000002 * s;
  float angle = PI * mouse.x; // Rotates 180 degrees based on mouse.x from -1 to 1
 // float newX = x * cos(angle) - y * sin(angle);
  //float newY = x * sin(angle) + y * cos(angle);
  
  

  // Calculate rotation angles based on mouse positions
  float angleX = radians(-90.0) * mouse.y*.3; // Rotation around X-axis based on mouse y
  float angleY = radians(90.0) * mouse.x; // Rotation around Y-axis based on mouse x
  float angleZ = radians(0.0) * mouse.x; // Rotation around Z-axis based on mouse x

  // Rotation matrices operations
  // Rotate around X
  float newY = y * cos(angleX) - z * sin(angleX);
  float newZ = y * sin(angleX) + z * cos(angleX);
  y = newY;
  z = newZ;

  // Rotate around Y
  float newX = x * cos(angleY) + z * sin(angleY);
  newZ = z * cos(angleY) - x * sin(angleY);
  x = newX;
  z = newZ;

  // Rotate around Z
  newX = x * cos(angleZ) - y * sin(angleZ);
  newY = x * sin(angleZ) + y * cos(angleZ);
  x = newX;
  y = newY;

  // Set the new position
  gl_Position = vec4(x, y, z, 1.0);
  
  //gl_Position = vec4(newX, newY, 0, 1);

  float b = 0.3 / mod(vertexId/len,1.);
  v_color = vec4(vec3(b), 0.5);
}
`;

export function getVertexEyesShader() {
  return applyTemplateToShader(eyeShader);
}

export const fragmentShader =`
precision mediump float;

varying vec4 v_color;

void main() {
  gl_FragColor = v_color;
}
`;