import { HistoryTexture } from './HistoryTexture';

// import {headerShader} from './shaders';

const settings = {
	backgroundColor: [0, 0, 0, 1],
	num: 30000,
};

class InstanceUniformNode extends Node {
	uniformNode: any;

	constructor() {

		super( 'vec3' );

		this.updateType = NodeUpdateType.OBJECT;

		this.uniformNode = uniform( new THREE.Color() );
		// this

	}

	update( frame: NodeFrame ) {

		const mesh = frame.object;
		//@ts-ignore
		const meshColor = mesh.color;

		this.uniformNode.value.copy( meshColor );

	}

	setup( /*builder*/ ) {

		return this.uniformNode;

	}

}

class Scene {
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private group!: THREE.Group;
  private seed: number;
	private objects: any[] = [];
	private then: number = Date.now();
	private time: number = Date.now();
	soundHistory!: HistoryTexture;
	volumeHistory!: HistoryTexture;
	floatSoundHistory!: HistoryTexture;
	touchHistory!: HistoryTexture;
	sum!: number;
	maxDif!: number;
	maxSample!: number;
	touchColumns: number = 32;
	obcount: number = 0;
	
  constructor() {
    this.seed = Math.floor(Math.random()*100);
  }

  public async init(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number, inputPath: string) {

		if ( WebGPU.isAvailable() === false && WebGL.isWebGL2Available() === false ) {

			// document.body.appendChild( WebGPU.getErrorMessage() );

			throw new Error( 'No WebGPU or WebGL2 support' );

		}

		this.camera = new THREE.PerspectiveCamera( 45, width / height, 1, 4000 );
		this.camera.position.set( 0, 200, 600 );
		//@ts-ignore
		this.renderer = new WebGPURenderer( { antialias: true, canvas } );

		this.scene = new THREE.Scene();

		// Grid

		const helper = new THREE.GridHelper( 1000, 40, 0x303030, 0x303030 );
		helper.position.y = - 75;
		this.scene.add( helper );

		// CubeMap

		// const path = '../assets/textures/cube/SwedishRoyalCastle/';
		// const format = '.jpg';
		// const urls = [
		// 	path + 'px' + format, path + 'nx' + format,
		// 	path + 'py' + format, path + 'ny' + format,
		// 	path + 'pz' + format, path + 'nz' + format
		// ];

		// const cTexture = new THREE.CubeTextureLoader().load( urls );
		
		// const loader = new THREE.ImageBitmapLoader().setPath(inputPath);
		console.log("loading!")
    // loader.setOptions({ imageOrientation: 'flipY' });
		// let cubeImages = []
		console.log("1")
		// for(let url of urls){
		// 	console.log("loading url", url);
		// 	cubeImages.push(await loader.loadAsync(url));
		// }
		// const canvasTextures = cubeImages.map(img => new THREE.CanvasTexture(img));
		// const cubeTextures = cubeImages.map(img => new THREE.CanvasTexture(img));
		
		console.log("after cubeimage loader")
		// console.log({cubeTextures});
		// Materials
		// const instanceUniform = nodeObject( new InstanceUniformNode());
		// const cTexture = new THREE.CubeTexture(cubeTextures);
		// const cubeTextureNode = new CubeTextureNode(cTexture);
		// const cubeTextureNode = cubeTexture( cTexture );

		// const material = new MeshStandardNodeMaterial();
		// material.colorNode = instanceUniform.add( cubeTextureNode );
		// material.emissiveNode = instanceUniform.mul( cubeTextureNode );
		//@ts-ignore
		const material = new InstancedPointsNodeMaterial( {

			color: 0xffffff,
			pointWidth: 10, // in pixel units

			vertexColors: true,
			alphaToCoverage: true,

		} );
		
		// Geometry
		
		// const geometry = new TeapotGeometry( 20, 4 );
		const geometry = new InstancedPointsGeometry();
		const instancedPoints = new InstancedPoints( geometry, material );
		instancedPoints.scale.set( 1, 1, 1 );

		const positions = [];
		const colors = [];

		const points = GeometryUtils.hilbert3D( new THREE.Vector3( 0, 0, 0 ), 20.0, 1, 0, 1, 2, 3, 4, 5, 6, 7 );

		const spline = new THREE.CatmullRomCurve3( points );
		const divisions = Math.round( 4 * points.length );
		const point = new THREE.Vector3();
		const pointColor = new THREE.Color();

		for ( let i = 0, l = divisions; i < l; i ++ ) {

			const t = i / l;

			spline.getPoint( t, point );
			positions.push( point.x, point.y, point.z );

			pointColor.setHSL( t, 1.0, 0.5, THREE.SRGBColorSpace );
			colors.push( pointColor.r, pointColor.g, pointColor.b );

		}


		// this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });

		console.log("renderer", this.renderer);
		this.renderer.setPixelRatio( pixelRatio );
		this.renderer.setSize( width, height, false);
		this.renderer.setAnimationLoop( this.animate );
		
		// this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
		// this.renderer.setPixelRatio(pixelRatio);
		// this.renderer.setSize(width, height, false);

    // this.camera = new THREE.PerspectiveCamera(40, width / height, 1, 1000);
    // this.camera.position.z = 200;

    // this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x444466, 100, 8000);
    this.scene.background = new THREE.Color(0x444466);

    // // this.group = new THREE.Group();
    // // this.scene.add(this.group);

    // const loader = new THREE.ImageBitmapLoader().setPath(path);
    // loader.setOptions({ imageOrientation: 'flipY' });
    // loader.load('../assets/matcap-porcelain-white.jpg', (imageBitmap) => {
		// 	console.log("scene loaded");
    //   const texture = new THREE.CanvasTexture(imageBitmap);

    //   const geometry = new THREE.IcosahedronGeometry(5, 8);
		// 	// materials
		// 	const instanceUniform = nodeObject( new InstanceUniformNode() );

		// 	const material = new MeshStandardNodeMaterial();
		// 	material.emissiveNode = instanceUniform.mul( cubeTextureNode );

    //   // const materials = [
    //   //   // new THREE.MeshMatcapMaterial({ color: 0xaa24df, matcap: texture }),
    //   //   new THREE.MeshMatcapMaterial({ color: 0x605d90, matcap: texture }),
    //   //   // new THREE.MeshMatcapMaterial({ color: 0xe04a3f, matcap: texture }),
    //   //   // new THREE.MeshMatcapMaterial({ color: 0xe30456, matcap: texture })
    //   // ];

    //   // for (let i = 0; i < 100; i++) {
    //   //   const material = materials[i % materials.length];
    //   //   const mesh = new THREE.Mesh(geometry, material);
    //   //   mesh.position.x = this.random() * 200 - 100;
    //   //   mesh.position.y = this.random() * 200 - 100;
    //   //   mesh.position.z = this.random() * 200 - 100;
    //   //   mesh.scale.setScalar(this.random() + 1);
    //   //   this.group.add(mesh);
    //   // }

      // this.animate(this.then);
    // });

		return this.renderer;
  }

  private animate = (time: number): void => {
		// let now = time;
		// let elapsed = now - this.then;
		// this.then = now;
		// this.time = this.time + elapsed;

		for ( let i = 0, l = this.objects.length; i < l; i++ ) {

			const object = this.objects[ i ];

			object.rotation.x += 0.01;
			object.rotation.y += 0.005;
			
		}
		// this.obcount = (this.obcount + 1000 ) % this.objects.length;
		// console.log({obcount: this.obcount})
		this.renderer.render( this.scene, this.camera );
		if(this.obcount > 100){
			console.log(this.objects[0].material);
			// this.objects[0].material = new THREE.Color( Math.random() * 0xffffff);
			this.obcount = -1;
		}
		if(this.obcount > -1) this.obcount++;
		// this.renderer.setSize(window.innerWidth, window.innerHeight); // on worker, need to fix.
    // this.group.rotation.y = -this.time / 4000;
		
		// this.updateSoundAndTouchHistory();
		// const volumeHistoryTex = this.state.volumeHistory.getTexture();
		// const touchHistoryTex = this.state.touchHistory.getTexture();
		// const historyTex = this.state.soundHistory.getTexture();

    // this.renderer.render(this.scene, this.camera);

    // requestAnimationFrame(this.animate);
  };

  private random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

	addMesh( geometry: THREE.BufferGeometry, material: MeshStandardNodeMaterial ) {

		const mesh = new THREE.Mesh( geometry, material );
		//@ts-ignore
		mesh.color = new THREE.Color( Math.random() * 0xffffff );

		mesh.position.x = ( this.objects.length % 8 ) * 100 - 300;
		mesh.position.z = Math.floor( this.objects.length / 8 ) * 2 - 200;
		mesh.position.y = Math.floor( this.objects.length / 8 ) * 5 - 200;

		mesh.rotation.x = Math.random() * 200 - 100;
		mesh.rotation.y = Math.random() * 40 - 2;
		mesh.rotation.z = Math.random() * 200 - 100;

		this.objects.push( mesh );

		this.scene.add( mesh );

	}
	

	updateSoundAndTouchHistory(){
		// calculate max 
		{
			const buf = this.soundHistory.sharedArray;
			const len = buf.length;
			var max = 0;
			for (let ii = 0; ii < len; ++ii) {
				const v = buf[ii];
				if (v > max) {
					max = v;
				}
			}
			this.volumeHistory.sharedArray[3] = max;
		}
		this.volumeHistory.sharedArray[0] = Math.abs(this.maxSample) * 255;
		this.volumeHistory.sharedArray[1] = this.sum * 255;
		this.volumeHistory.sharedArray[2] = this.maxDif * 127;

		// Update time
		// for (let ii = 0; ii < this.touchColumns; ++ii) {
		// 	var offset = ii * 4;
		// 	this.touchHistory.buffer[offset + 3] = this.time;
		// }

		// gl.disable(gl.DEPTH_TEST);
		// gl.disable(gl.BLEND);

  	// Three.js equivalent of setting buffers and attributes
		// const material = this.historyProgramInfo;
		// const geometry = this.quadGeometry;
		// this.quadMesh;

		this.volumeHistory.update();
		this.soundHistory.update();
		if (this.floatSoundHistory) {
			this.floatSoundHistory.update();
		}
		// this.touchHistory.update();
	}
}

export default Scene;
