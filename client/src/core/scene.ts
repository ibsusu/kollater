import { Entity } from './glitzEntity';
import { Renderer, Transform, Camera, Vec2, Texture } from 'ogl';
// type TypedArray = Uint8Array | Float32Array | Int32Array | Uint16Array | Float64Array;

interface SceneParams {
	canvas: HTMLCanvasElement|OffscreenCanvas,
	width: number,
	height: number,
	pixelRatio: number
  pointer: { baseX: number, x: number, baseY: number, y: number };
};

type SharedData = {
  mutex: SharedArrayBuffer;
  volume: SharedArrayBuffer;
  sound?: SharedArrayBuffer;
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
  private volumeArray!: Uint8Array;
  private soundArray!: Float32Array;
	// private time: number = Date.now();
  mutex!: Int32Array;
	sharedData!: SharedData;
	sum!: number;
	maxDif!: number;
	maxSample!: number;
	touchColumns: number = 32;
  frameLagCount: number = 0;
  frameCount: number = 0;
	volumeTexture!: Texture;
  soundTexture!: Texture;
  pointer: { baseX: number; x: number; baseY: number; y: number; };
  constructor({canvas, width, height, pixelRatio, pointer}: SceneParams) {
    this.canvas = canvas;
		this.devicePixelRatio = pixelRatio;
    this.pointer = pointer;
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
			volume: new SharedArrayBuffer(4)
    };
  }

  async init() {
    if(!this.sharedData.sound) throw "Sound must be set as a sharedArrayBuffer before scene can be initialized";
		this.soundSampleCount = Math.min(this.soundSampleCount, this.renderer.gl.getParameter(this.renderer.gl.MAX_TEXTURE_SIZE));
		const vertexCount = 100000;
    this.mutex = new Int32Array(this.sharedData.mutex);
    // const numParticles = 65536;
    let gl = this.renderer.gl;


    this.volumeArray = new Uint8Array(this.sharedData.volume);
    this.soundArray = new Float32Array(this.sharedData.sound);
    
    this.soundArray.fill(Math.random() * -400);
    // console.log('sharedData sound length', this.sharedData.sound.byteLength, soundArray.length, this.soundArray.length);
    

    
    let volume = new Texture(this.renderer.gl, {
      // image: volumeArray,
      image: this.volumeArray,
      // image: new Uint8Array(this.volumeArray.length).fill(0),
      width: 1,
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
    this.volumeTexture = volume;
    // console.log("soundbyteLength:", (this.sharedData.sound.byteLength));
    // let arr = new Float32Array(4096*4).fill(-891.048828125)
    let sound = new Texture(this.renderer.gl, {
      image: this.soundArray,
      // image: soundArray,
      // image: new Float32Array(this.soundArray.byteLength).fill(-891.048828125),
      width: 16,
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
    this.soundTexture = sound;

		this.uniforms = {
			mouse: {value: new Vec2(0.2,0.5)},
			resolution: {value: new Vec2(this.canvas.width, this.canvas.height)},
			// background: {value: new Vec4(200,200,200,200)},
			time: {value: 0},
			vertexCount: {value: vertexCount},
			volume: {value: this.volumeTexture},
			sound: {value: this.soundTexture},
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
    const gl = this.renderer.gl;
    const mutexMask = Atomics.load(this.mutex, 0);
    // console.log({mutexMask});
    if(mutexMask === 3){
      
      // let lag = this.frameCount - this.frameLagCount;
      // this.frameLagCount = this.frameCount;
      // console.log({volumeArray: this.volumeArray, })
      //@ts-ignore
      // for (let i = 0; i < this.volumeTexture.image.length; i++) {
        //@ts-ignore
        // this.volumeTexture.image[i] = this.volumeArray[i % this.volumeArray.length];
      // }
      // this.volumeTexture.image = this.
      // console.log("update is needed", this.volumeTexture.needsUpdate);
      // (this.volumeTexture.image! as Uint8Array).fill(this.volumeArray.slice(0,4));
      this.volumeTexture.needsUpdate = true;
      // console.log("update is needed", this.soundTexture.image);
      
      // let t = this.volumeTexture;
      // gl.texImage2D(t.target,t.level, t.internalFormat, t.format, t.type, this.volumeTexture); 
      // (this.soundTexture.image! as Float32Array).set(this.soundArray);

      this.soundTexture.needsUpdate = true;
      // console.log(`rendering, lag: ${lag}, sound buffer:`, this.soundTexture.image as Float32Array);
      Atomics.store(this.mutex, 0, 0);
    }
    this.frameCount++;

    this.uniforms.time.value = time*0.001;
    this.uniforms.mouse.value.x = this.pointer.x;
    this.uniforms.mouse.value.y = this.pointer.y;

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
}


export default Scene;
