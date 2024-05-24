interface HistoryTextureOptions {
  width: number;
  length?: number;
  type?: THREE.TextureDataType;
  format?: THREE.PixelFormat; // WebGLRenderingContextBase.ALPHA, etc.
  min?: THREE.TextureFilter;
  mag?: THREE.MagnificationTextureFilter;
  historyFormat?: THREE.PixelFormat;
}

export class HistoryTexture {
  sharedBuffer: SharedArrayBuffer;
  sharedArray: Uint8Array | Float32Array;
  buffer: Uint8Array;
  floatBuffer!: Float32Array;
  numSamples: number = 60*4; // 4 seconds
  private srcRenderTarget: THREE.WebGLRenderTarget;
  private dstRenderTarget: THREE.WebGLRenderTarget;
  private texture: THREE.DataTexture;
  private material: THREE.ShaderMaterial;
  private scene: THREE.Scene;
  private quad: THREE.Mesh;
  private camera: THREE.Camera;

  constructor(private renderer: THREE.WebGLRenderer, options: HistoryTextureOptions) {
    const width = options.width;
    const length = options.length;
    const type = options.type || THREE.UnsignedByteType;
    const format = options.format || THREE.RGBAFormat;

    // Create data buffer and texture
    const size = width * 4; // Assuming RGBA
    this.buffer = new Uint8Array(size);
    this.sharedBuffer = new SharedArrayBuffer(size);
    this.sharedArray = type ===  THREE.FloatType ? new Float32Array(this.sharedBuffer) : new Uint8Array(this.sharedBuffer);
    this.texture = new THREE.DataTexture(this.buffer, width, 1, format, type);
    this.texture.minFilter = options.min || THREE.LinearFilter;
    this.texture.magFilter = options.mag || THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;

    // Create render targets...
    const historyFormat = options.historyFormat || THREE.RGBAFormat;
    const renderTargetOptions = {
      format: historyFormat,
      type: type,
      minFilter: options.min || THREE.LinearFilter,
      magFilter: options.mag || THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    };

    this.srcRenderTarget = new THREE.WebGLRenderTarget(width, length, renderTargetOptions);
    this.dstRenderTarget = new THREE.WebGLRenderTarget(width, length, renderTargetOptions);

    // Shaders, basic ones for uvs
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D u_texture;
      uniform float u_mix;
      uniform mat4 u_matrix;
      varying vec2 vUv;
      void main() {
        vec2 uv = (u_matrix * vec4(vUv, 0, 1)).xy;
        gl_FragColor = mix(texture2D(u_texture, vUv), texture2D(u_texture, uv), u_mix);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_texture: { value: null },
        u_mix: { value: 0 },
        u_matrix: { value: new THREE.Matrix4() },
      },
    });

    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(quadGeometry, this.material);
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.Camera();
  }

  public update(): void {
    // Swap render targets
    [this.srcRenderTarget, this.dstRenderTarget] = [this.dstRenderTarget, this.srcRenderTarget];

    this.texture.needsUpdate = true;

    // Copy from src to dst one pixel down
    this.material.uniforms.u_texture.value = this.srcRenderTarget.texture;
    this.material.uniforms.u_mix.value = 1;
    this.material.uniforms.u_matrix.value.identity();
    this.material.uniforms.u_matrix.value.setPosition(0, 2 / this.dstRenderTarget.height, 0);
    this.renderer.setRenderTarget(this.dstRenderTarget);
    this.renderer.render(this.scene, this.camera);

    // Copy audio data into the top row of dst
    this.material.uniforms.u_texture.value = this.texture;
    this.material.uniforms.u_mix.value = this.texture.format === THREE.AlphaFormat ? 0 : 1;
    this.material.uniforms.u_matrix.value.identity();
    this.material.uniforms.u_matrix.value.setPosition(0, -(this.dstRenderTarget.height - 0.5) / this.dstRenderTarget.height, 0);
    this.material.uniforms.u_matrix.value.scale(1, 1 / this.dstRenderTarget.height, 1);
    this.renderer.setRenderTarget(this.dstRenderTarget);
    this.renderer.render(this.scene, this.camera);

    this.renderer.setRenderTarget(null);
  }

  public getTexture(): THREE.Texture {
    return this.dstRenderTarget.texture;
  }
}
