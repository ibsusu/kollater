const Kollator = `#version 300 es
  
  precision highp float;

  layout(std140) uniform Group{
    uniform vec4 groupPosition[200];
    uniform vec4 groupRotor[200];
  };

  uniform vec3 colors;
  uniform vec2 uResolution;           // viewport resolution (in pixels)
  uniform vec2 u_adjust_uv;
  uniform sampler2D iChannel0;          // input channel. XX = 2D/Cube
  uniform vec2 iMouse;
  uniform float iTime;
  in vec2 vUv;
  in float vRotation;

  out vec4 fragColor;

  vec2 rotate2d( vec2 v, float a) {
      mat2 m = mat2(cos(a), -sin(a), sin(a),  cos(a));
      vec2 vout = m * v;
      return vout;
  }


  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    // vec2 uv = vUv;
    vec2 uv = (-1.0 + 2.0 * vUv);
    // float mid = 0.5;
    // float timeRot = vRotation+iTime*.3;
    // vec3 rotated = vec3(
    //   cos(timeRot) * (gl_PointCoord.x - mid) + sin(timeRot) * (gl_PointCoord.y - mid) + mid,
    //   cos(timeRot) * (gl_PointCoord.y - mid) - sin(timeRot) * (gl_PointCoord.x - mid) + mid,
    //   cos(timeRot) * (gl_PointCoord.x - mid) - sin(timeRot) * (gl_PointCoord.y - mid) + mid
    // );

    // vec2 resolution = fragCoord.xy / vUv.xy ;
    vec2 resolution = .2*fragCoord.xy / vUv.xy*u_adjust_uv;

    // vec2 resolution = (fragCoord.xy / vec2(1., 1.));

    // vec2 uv_cent = (fragCoord - 0.5*resolution.xy) / resolution.y;
    // do not touch
    // vec2 uv_cent =  4.*(fragCoord.xy - 0.5*vec2(1920.0, 1200.0)) / 1200.0;
    

    // vec2 uv_cent = (fragCoord.xy - .5*resolution.xy) / resolution.y;
    // uv_cent = 6.*(fragCoord.xy-iMouse.xy)/uResolution.y;

    // vec2 uv_cent = 2.5*uv.xy*u_adjust_uv.yx - vec2(.004*iMouse.x/u_adjust_uv.x, .0045*iMouse.y/u_adjust_uv.y) + vec2(5., 2.5);
    // vec2 uv_cent = 1.5*uv*u_adjust_uv.yx - iMouse.xy*0.0016 + vec2(1.2, .6);
    vec2 uv_cent = (uv+0.05*iMouse.xy)*1.5*u_adjust_uv.yx;

    
    // This is a very cool and very flexible shader if you know what to tweak.  easy to get lost

    // tunnel aka inwards traveling waves: 1./length(uv_cent)*2.0;
    // nova aka outwards traveling waves:  length(uv_cent)*2.0;
    // inwards hallway:  1./length(uv_cent.x)*2.0;
    // rift: length(uv_cent.x)*2.0;
    // tilted hallway  1./length(uv_cent.x+uv_cent.y)*2.0;
    // horizon: 1./length(uv_cent.x+uv_cent.y)*2.0;
    // multiply the whole thing i.e the (2.0) to change how zoomed in or out you want to be
    float len = length(uv_cent);
    
    // changes the width of each wave and how they radiate.
    // radiate from the center: vec2(uv_cent / len)*.4;
    // radiate split left and right: vec2(uv_cent / len)*.4;
    // radiate split top and bottom: vec2(uv_cent.y / len)*.4;
    // width of waves: multiple the whole thing by a float or something
    //vec2(uv_cent.x*.3+uv_cent.y*.9 / len)*.4;
    
    vec2 rad = vec2(uv_cent / len);

    // original shader
    // vec2 rip = rad * sin((len*2. * 50.) - iTime);
    
    // float light_a = dot(rip, vec2(0.5, 0.5));
    // float light_b = dot(rip, vec2(-0.5, -0.5));
    
    // vec3 light_col = (vec3(pow(light_a + 1.0, 2.0)) * vec3(1.0,0.60,0.35)) +
    //            (vec3(pow(light_b + 1.0, 3.0)) * vec3(0.05,0.08,0.1));
    
    // vec4 tex = texture(iChannel0, uv + (rip / 5.0), 1.0);
    
    // vec3 col = (tex.r * 1.25) * (light_col * 1.5) * (1.0 - len);

    // // Output to screen
    // fragColor = vec4(col, 0.0);

    //---------------- ATT shader -----------------
    // // requries infi.jpg texture
    // vec2 rip = rad * sin((uv_cent.y * 40.0) - iTime*2.);
    // vec2 rip2 = rad * sin((uv_cent.y * 40.0) - iTime*2.);

    // //-----------------------------------
    // float light_a = dot(rip, vec2(0.5, 0.5));
    // float light_b = dot(rip, vec2(-.5, -.5));
    
    // vec3 light_col = (vec3(pow(light_a + 1.0, 2.0)) * vec3(1.0,0.60,0.35)) +
    //            (vec3(pow(light_b + 1.0, 3.0)) * vec3(0.05,0.08,0.1));

    // //-----------------------------------                
    // float light_a2 = dot(rip2, vec2(0.5, 0.5));
    // float light_b2 = dot(rip2, vec2(-0.5, -0.5));
    
    // vec3 light_col2 = (vec3(pow(light_a2 + 1.0, 2.0)) * vec3(1.0,0.60,0.35)) +
    //            (vec3(pow(light_b2 + 1.0, 3.0)) * vec3(0.05,0.08,0.1));


    // vec4 tex = texture(iChannel0, vec2(uv.y-uv.x + (rip / 5.0).y, 0), 1.0);
    // vec4 tex2 = texture(iChannel0, vec2(uv.y-uv.x + (rip2 / 5.0).y, 0), 1.0);
    
    // vec3 col = (tex.r * 1.25) * (light_col * 1.5) * (1.0 - len);
    // vec3 col2 = (tex2.r * 1.25) * (light_col2 * 1.5) * (1.0 - len);
  
    // fragColor = (vec4(col, 0.0)*log(vec4(col2, 0.0)) + log(log(vec4(col, 0.0)+vec4(col2, 0.0))));

    // ------------------Agginym Shader Dec 2021 ----------------------

    // modifying these is a bit funny.
    // speed up wave propagation: rad * sin((len * 40.0) - iTime*$BIG_NUMBER);
    // wave coalescing, darkzone flashing or pulsing can be achieved by ofsetting the iTime*$BIG_NUMMBER,
    //   aka rip's $BIG_NUMBER would be 10 and rip2's $BIGNUMBER would be 15 or something that makes sense.
    // wave frequency:  rad * sin((len * $SOME_FLOAT) - iTime);
    vec2 rip = rad * sin((len * 50.0) - iTime*10.);
    vec2 rip2 = rad * sin((len * 50.0) - iTime*10.);
    
    // i don't really know what these do but they end up making things brighter somehow
    float light_a = dot(rip, vec2(0.5*sin(iTime), 0.2));
    float light_b = dot(rip, vec2(0.1, 0.));
    
    // makes it colorful.  This part right here is art.  Paint away with rgb values
    vec3 light_col = (vec3(pow(light_a + 2.2, 1.9)) * vec3(1.0,0.60,0.35)) +
               (vec3(pow(light_b + 1.0, 3.0)) * vec3(0.95,0.48,0.5));

    // brighter again
    float light_a2 = dot(rip2, vec2(0.5*sin(iTime*2.), 0.2*cos(iTime*1.3)));
    float light_b2 = dot(rip2, vec2(0., 0.));
    
    // second part of the colors
    vec3 light_col2 = (vec3(pow(light_a2 + 1.0, 2.0)) *vec3(1.0,0.60,0.35)) +
               (vec3(pow(light_b2 + 1.0, 3.0)) * vec3(0.05,0.08,0.1));
    
    // just the textures, tweaking doesn't really help much here.
    vec4 tex = texture(iChannel0, rotate2d(uv, 0.3*iTime) + (rip / 5.0), 1.0);
    vec4 tex2 = texture(iChannel0, rotate2d(uv, 0.3*iTime)+ (rip2 / 5.0), 1.0);


    // messing with len zooms in or out non destructively for each color
    // messing with the tex or light_cols increase the intensity of the colors
    vec3 col = (tex.r * 1.25) * (light_col * 1.5) * (1.0 - len);
    vec3 col2 = (tex2.r * 1.25) * (light_col2 * 2.5) * (1.0 - len*.7);

    // the log stuff creates the Agginym ring of light
    // it flattens the color in various ways.
    // adding, substracting, dividing, multiplying the vecs here
    //   in combination with various mathematical functions like log or abs or whatever can
    //   create some pretty stylish effects.
    // fragColor = vec4(col, 0.0)*log(vec4(col2, 0.0)) + log(log(vec4(col, 0.0)+vec4(col2, 0.0)));

    // stage zero edge red
    // fragColor = log(vec4(col2, 0.0)) + vec4(-1.0, -1.0, -1.0, 0.0);

    // stage one center red
    // fragColor = vec4(col, 0.0) + vec4(-1.0, -1.0, -1.0, 0.0);

    // stage two red ring
    // fragColor = vec4(col, 0.0)*log(vec4(col2, 0.0)) + vec4(-1.0, -1.0, -1.0, 0.0);

    // stage three blueish white ring
    // the last vec is the rgba filter over everything
    fragColor = log(-log(vec4(col, 0.0)+vec4(col2, 1.0))) + vec4(-1.0, -1.0, -1.0, 0.0);

    // fragColor = exp(exp(vec4(col, 0.0)*.05+vec4(col2, 0.0)*.05)) + vec4(-2.0, -2.0, -2.0, .010);
    // fragColor = tex;
    // stage 4 full state
    // fragColor = vec4(col, 0.0)*log(vec4(col2, 0.0)) + log(log(vec4(col, 0.0)+vec4(col2, 0.0)));

  }

  void main() {
    mainImage(fragColor, gl_FragCoord.xy);
  }
`;

export default Kollator;