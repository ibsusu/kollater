import {AttributeMap, Geometry, Mesh, OGLRenderingContext, Program, ProgramOptions, Transform, Vec3} from 'ogl';
import { getVertexEyesShader, fragmentShader, particleFragmentShader, particleVertexShader } from './shaders';
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
  vertex: particleVertexShader, //getVertexEyesShader(),
  fragment: particleFragmentShader
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
    this.count = count ?? 1;
    this.uniforms = uniforms;
    this.programOptions = programOptions ?? defaultProgramOptions;
    this.geometryOptions = geometryOptions ?? {position:{size:3, data: new Float32Array(this.count*3)}};
  }

  async init() {
    let vertexIds = new Float32Array(100);
    for(let i=0;i<vertexIds.length;++i){
      vertexIds[i] = i;
    }
    const num = 100;
    const position = new Float32Array(num * 3);
    const random = new Float32Array(num * 4);

    for (let i = 0; i < num; i++) {
        position.set([Math.random(), Math.random(), Math.random()], i * 3);
        random.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }

    let geometry = new Geometry(this.gl, {...this.geometryOptions, random: { size: 4, data: random },vertexId: {size:4, data: vertexIds}});
    console.log("entityUniforms", this.uniforms);
    // let program = new Program(this.gl, {...this.programOptions, uniforms: this.uniforms});
    let program = new Program(this.gl, {
      ...this.programOptions,
      transparent: true,
      depthTest: false,
      uniforms: {uTime: {value: 0}}
    });

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
