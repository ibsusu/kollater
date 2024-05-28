import {AttributeMap, Geometry, Mesh, OGLRenderingContext, Program, ProgramOptions, Transform, Vec3} from 'ogl';
import { getVertexEyesShader, fragmentShader, eyesVShader, particleFragmentShader, particleVertexShader } from './shaders';
export interface EntityParams {
  gl: OGLRenderingContext,
  scene: Transform,
  uniforms: {},
  points: boolean,
  count?: number
  programOptions?: ProgramOptions,
  geometryOptions?: AttributeMap
};

const defaultProgramOptions = {
  // vertex: particleVertexShader, //getVertexEyesShader(),
  // fragment: particleFragmentShader
  vertex: eyesVShader,//getVertexEyesShader(),
  fragment: fragmentShader
};

export class Entity {
  floatBuffer!: Float32Array;
  mesh!: Mesh;
  
  points: boolean;
  gl: OGLRenderingContext;
  scene: Transform;
  count: number;
  uniforms: {};

  programOptions: Partial<ProgramOptions>;
  geometryOptions: Partial<AttributeMap>;
  

  constructor({gl, scene, uniforms, points, count, programOptions, geometryOptions}: EntityParams) {
    this.gl = gl;
    this.points = points;
    this.scene = scene;
    this.count = count ?? 2000;
    this.uniforms = uniforms;
    this.programOptions = programOptions ?? defaultProgramOptions;
    this.geometryOptions = geometryOptions ?? {position:{size:1, data: new Float32Array(this.count*3)}};
  }

  async init() {
    console.log("entity count", this.count);
    let vertexIds = new Float32Array(this.count*3.2);
    for(let i=0;i<vertexIds.length;++i){
      vertexIds[i] = i;
    }
    console.log("vertexId count", vertexIds.length);
    console.log({geops: this.geometryOptions, uniforms: this.uniforms});

    let geometry = new Geometry(this.gl, {...this.geometryOptions, vertexId: {size:1, data: vertexIds}});
    console.log("entityUniforms", this.uniforms);

    let program = new Program(this.gl, {
      ...this.programOptions, 
      transparent: false,
      depthTest: true,
      uniforms: this.uniforms,
    });

    program.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    // let program = new Program(this.gl, {
    //   ...this.programOptions,
    //   transparent: true,
    //   depthTest: false,
    //   uniforms: {uTime: {value: 0}}
    // });

    if(this.points) {
      this.mesh = new Mesh(this.gl, {mode: this.gl.POINTS, geometry, program})
    }
    else {
      this.mesh = new Mesh(this.gl, {geometry, program});
    }
  }
  
  setParent(){
    this.mesh.setParent(this.scene);
  }

  pos(p: Vec3){
    this.mesh.position.set(p);
  }

  rot(r: Vec3){
    this.mesh.rotation.x = r.x;
    this.mesh.rotation.y = r.y;
    this.mesh.rotation.z = r.x;
  }
}
