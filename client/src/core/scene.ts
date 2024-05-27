import { INFINITY } from 'three/examples/jsm/nodes/Nodes.js';
import { Entity } from './glitzEntity';
// import { GlitzGroup} from './glitzGroup';
import { Renderer, Transform, Camera, Vec2, Vec4, Texture } from 'ogl';

// import { getVertexEyesShader } from './shaders';

type TypedArray = Uint8Array | Float32Array | Int32Array | Uint16Array | Float64Array;

interface SceneParams {
	canvas: HTMLCanvasElement|OffscreenCanvas,
	width: number,
	height: number,
	pixelRatio: number
	// data: Record<string, TypedArray|SharedArrayBuffer>
};

class Scene {
  private camera: Camera
  private scene!: Transform;
  renderer!: Renderer;
	devicePixelRatio: number;
  canvas: any;
	autoRender = true;
	canHandleFloat: boolean = true;
	soundSampleCount: number = 128;
  private entities: Entity[] = [];
	private uniforms: any;
	// private time: number = Date.now();
  mutex!: Int32Array;
	sharedData!: Record<string, SharedArrayBuffer>;
	// mouse: Vec2;
	sum!: number;
	maxDif!: number;
	maxSample!: number;
	touchColumns: number = 32;
	
  constructor({canvas, width, height, pixelRatio}: SceneParams) {
    this.canvas = canvas;
		this.devicePixelRatio = pixelRatio;
		const c = canvas as HTMLCanvasElement;

		// this.renderer = new Renderer({canvas: c, width: width*1.5, height: height, antialias: true});
		this.renderer = new Renderer({canvas: c, width, height});

  //  this.renderer.gl.clearColor(.5,.5,.5,0);
    this.renderer.gl.clearColor(0, 0, 0, 0);

		// this.camera = new Camera(this.renderer.gl, {
		// 	fov: 70,
		// 	aspect: 6,
		// 	near: 0.1,
		// 	far: 3000,
		// });
    this.camera = new Camera(this.renderer.gl, { fov: 15 });
    this.camera.position.z = 15;
    this.camera.position.x = -3;
		this.scene = new Transform();
		// this.camera.position.z = 1000;
		// this.camera.setParent(this.scene);
    this.camera.perspective({aspect: this.canvas.width/ this.canvas.height});
    this.sharedData = {
      mutex: new SharedArrayBuffer(4),
			volume: new SharedArrayBuffer(64)
    };
  }

  public async init() {
    if(!this.sharedData.sound) throw "Sound must be set as a sharedArrayBuffer before scene can be initialized";
		this.soundSampleCount = Math.min(this.soundSampleCount, this.renderer.gl.getParameter(this.renderer.gl.MAX_TEXTURE_SIZE));
		const vertexCount = 100000;
    // let vertexIds = new Float32Array(vertexCount);
    // for(let i=0;i<vertexIds.length;++i){
    //   vertexIds[i] = i;
    // }
    this.mutex = new Int32Array(this.sharedData.mutex);
    // const numParticles = 65536;
    let gl = this.renderer.gl;
    let textureSize = getMinumTextureSize(this.sharedData.sound.byteLength);
    this.maxSample = 0.040230318903923035;
    this.maxDif = 0.20605286955833435;
    this.sum = 0.08247681108270914;
    
    let volumeArray = new Uint8Array([26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222,26,14,29,222]);
    // volumeArray[0] = 26;
    // {
    //   const buf = s.soundHistory.buffer;
    //   const len = buf.length;
    //   var max = 0;
    //   for (let ii = 0; ii < len; ++ii) {
    //     const v = buf[ii];
    //     if (v > max) {
    //       max = v;
    //     }
    //   }
    //   s.volumeHistory.buffer[3] = max;
    // }
    // s.volumeHistory.buffer[0] = Math.abs(s.maxSample) * 255;
    // s.volumeHistory.buffer[1] = s.sum * 255;
    // s.volumeHistory.buffer[2] = s.maxDif * 127;
    

    
    let volume = new Texture(this.renderer.gl, {
      image: volumeArray,
      // image: new Uint8Array(this.sharedData.volume).fill(0),
      width: 4,
      type: gl.UNSIGNED_BYTE,
      format: gl.RGBA,
      internalFormat: gl.RGBA,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      flipY: false,
    });
    console.log("soundbyteLength:", (this.sharedData.sound.byteLength));
    let arr = new Float32Array(4096*4).fill(-891.048828125)
    let sound = new Texture(this.renderer.gl, {
      image: arr,
      // image: new Float32Array(this.sharedData.sound.byteLength*20).fill(-891.048828125),
      width: 64,
      // height: 64,
      type: gl.FLOAT,
      format: gl.RGBA,
      //@ts-ignore 2339
      internalFormat: gl.renderer.isWebgl2 ? gl.RGBA32F : gl.RGBA,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      flipY: false,
    });

		this.uniforms = {
			mouse: {value: new Vec2(0.2,0.5)},
			resolution: {value: new Vec2(this.canvas.width, this.canvas.height)},
			background: {value: new Vec4(200,200,200,200)},
			time: {value: 0},
			vertexCount: {value: vertexCount},
      // vertexId: {value: vertexIds},
			// volume: {value: new Uint8Array(this.sharedData.volume)},
			// sound: {value: this.canHandleFloat? new Float32Array(this.sharedData.sound.byteLength) : new Uint8Array(this.sharedData.sound.byteLength)},
			volume: {value: volume},
			sound: {value: sound},
      // _dontUseDirectly_pointSize: {value: this.devicePixelRatio},
      _dontUseDirectly_pointSize: {value: 1},
		};

		let particlesEntity = new Entity({
			gl: this.renderer.gl, 
			scene: this.scene,
			uniforms: this.uniforms,
			count: vertexCount,
			points: true,
		 });

		 particlesEntity.init();
		 particlesEntity.setParent();
		 this.entities.push(particlesEntity);

		this.render();
  }

  private render = (time: number=0): void => {
		if(this.autoRender){
			requestAnimationFrame(this.render.bind(this));
		}
    let gl = this.renderer.gl;
		// let delta = time - this.time;
		// this.time = time;

    this.uniforms.time.value = time*0.001;
    gl.lineWidth(1);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor.apply(gl,[0, 0, 0, 1] );
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // this.entities[0].mesh.program.uniforms.uTime.value = this.time *0.001;
		this.renderer.render({scene: this.scene, camera: this.camera});
		// this.updateSoundAndTouchHistory();
  };
  
	// updateSoundAndTouchHistory(){
	// 	// calculate max 
	// 	{
	// 		const buf = this.soundHistory.sharedArray;
	// 		const len = buf.length;
	// 		var max = 0;
	// 		for (let ii = 0; ii < len; ++ii) {
	// 			const v = buf[ii];
	// 			if (v > max) {
	// 				max = v;
	// 			}
	// 		}
	// 		this.volumeHistory.sharedArray[3] = max;
	// 	}
	// 	this.volumeHistory.sharedArray[0] = Math.abs(this.maxSample) * 255;
	// 	this.volumeHistory.sharedArray[1] = this.sum * 255;
	// 	this.volumeHistory.sharedArray[2] = this.maxDif * 127;

	// 	this.volumeHistory.update();
	// 	this.soundHistory.update();
	// 	if (this.floatSoundHistory) {
	// 		this.floatSoundHistory.update();
	// 	}
	// 	// this.touchHistory.update();
	// }
}

function getMinumTextureSize(arraySize: number){
  return Math.pow(2, Math.ceil(Math.log(Math.ceil(Math.sqrt(arraySize))) / Math.LN2));
}

export default Scene;
