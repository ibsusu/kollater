import { Entity } from './glitzEntity';
// import { GlitzGroup} from './glitzGroup';
import { Renderer, Transform, Camera, Vec2, Vec4 } from 'ogl';
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
	autoRender = true;
	canHandleFloat: boolean = true;
	soundSampleCount: number = 128;
  private entities: Entity[] = [];
	private uniforms: any;
	private time: number = Date.now();
  mutex!: Int32Array;
	sharedData!: Record<string, SharedArrayBuffer>;
	// mouse: Vec2;
	sum!: number;
	maxDif!: number;
	maxSample!: number;
	touchColumns: number = 32;
	
  constructor({canvas, width, height, pixelRatio}: SceneParams) {
		this.devicePixelRatio = pixelRatio;
		const c = canvas as HTMLCanvasElement;
		this.renderer = new Renderer({canvas: c, width, height});
  //  this.renderer.gl.clearColor(.5,.5,.5,0);
    this.renderer.gl.clearColor(1, 1, 1, 1);

		// this.camera = new Camera(this.renderer.gl, {
		// 	fov: 70,
		// 	aspect: 6,
		// 	near: 0.1,
		// 	far: 3000,
		// });
    this.camera = new Camera(this.renderer.gl, { fov: 15 });
    this.camera.position.z = 15;
		this.scene = new Transform();
		// this.camera.position.z = 1000;
		this.camera.setParent(this.scene);
    this.camera.perspective({aspect: this.renderer.gl.canvas.width/ this.renderer.gl.canvas.height});
    this.sharedData = {
      mutex: new SharedArrayBuffer(4),
			volume: new SharedArrayBuffer(4)
    };
  }

  public async init() {
    if(!this.sharedData.sound) throw "Sound must be set as a sharedArrayBuffer before scene can be initialized";
		this.soundSampleCount = Math.min(this.soundSampleCount, this.renderer.gl.getParameter(this.renderer.gl.MAX_TEXTURE_SIZE));
		const vertexCount = 100;
    let vertexIds = new Float32Array(vertexCount);
    for(let i=0;i<vertexIds.length;++i){
      vertexIds[i] = i;
    }
    this.mutex = new Int32Array(this.sharedData.mutex);

		this.uniforms = {
			mouse: {value: new Vec2(0,0)},
			resolution: {value: new Vec2(this.renderer.width, this.renderer.height)},
			background: {value: new Vec4(200,200,200,200)},
			time: {value: 10.0},
			vertexCount: {value: vertexCount},
      // vertexId: {value: vertexIds},
			// volume: {value: new Uint8Array(this.sharedData.volume)},
			// sound: {value: this.canHandleFloat? new Float32Array(this.sharedData.sound.byteLength / 4) : new Uint8Array(this.sharedData.sound.byteLength)},
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

		this.render(this.time);
  }

  private render = (time: number): void => {
		if(this.autoRender){
			requestAnimationFrame(this.render.bind(this));
		}
		// let delta = time - this.time;
		this.time = time;

    this.uniforms.time.value = time;
    this.entities[0].mesh.program.uniforms.uTime.value = this.time *0.001;
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

export default Scene;
