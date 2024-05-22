import { WebGLRenderer, LinearFilter, NearestFilter, FloatType, AlphaFormat } from 'three';
import { HistoryTexture } from './HistoryTexture';
import Scene from './scene';

export class GlitzController {
  private renderer: WebGLRenderer | null = null;
  private context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private volumeHistory: HistoryTexture | null = null;
  private soundHistory: HistoryTexture | null = null;
  private floatSoundHistory: HistoryTexture | null = null;
  private autoRender = { value: true };
  private mouse = { baseX: -.1, x: 0, baseY: 0, y: 0 };
  messagePort!: MessagePort;

  constructor() {}

  async init(data: any) {
    console.log("glitzcontroller data", {data});
    const width = data.innerWidth;
    const height = data.innerHeight;
    const pixelRatio = data.devicePixelRatio;

    const sceneInstance = new Scene();
    console.log('init scene called');
    this.renderer = sceneInstance.init(data.canvas, width, height, pixelRatio, './' );
    this.context = this.renderer.getContext();
    const canUseFloat = this.checkCanUseFloat(this.context);
    const canRenderToFloat = this.checkCanRenderToFloat(this.renderer);
    const canFilterFloat = canUseFloat && this.context.getExtension("OES_texture_float_linear");
    const maxTextureSize = this.context.MAX_TEXTURE_SIZE;
    const numSoundSamples = Math.min(maxTextureSize, 1024);
    const numHistorySamples = 60 * 4;

    this.volumeHistory = new HistoryTexture(this.renderer, {
      width: 4,
      length: numHistorySamples,
      format: AlphaFormat
    });

    this.soundHistory = new HistoryTexture(this.renderer, {
      width: numSoundSamples,
      length: numHistorySamples,
      format: AlphaFormat
    });

    if (canUseFloat && canRenderToFloat) {
      const floatFilter = canFilterFloat ? LinearFilter : NearestFilter;
      this.floatSoundHistory = new HistoryTexture(this.renderer, {
        width: numSoundSamples,
        length: numHistorySamples,
        min: floatFilter,
        mag: floatFilter,
        format: AlphaFormat,
        type: FloatType,
      });
    }

    return {
      resize: this.resize.bind(this),
      autoRender: this.autoRender,
      mouse: this.mouse,
    };
  }

  setPort(messagePort: MessagePort){
    this.messagePort = messagePort;
    
  }
  getSharedBuffers(){
    this.messagePort.postMessage({
      reason: "sharedBuffers",
      volumeHistory: this.volumeHistory!.sharedBuffer,
      soundHistory: this.soundHistory!.sharedBuffer,
      floatSoundHistory: this.floatSoundHistory!.sharedBuffer,
    });
  }

  resize() {
    console.log("resizing");
    // Implement the three.js method to resize the renderer and adjust camera perspective
  }

  private checkCanUseFloat(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    return gl.getExtension("OES_texture_float") ? true : false;
  }

  private checkCanRenderToFloat(renderer: WebGLRenderer) {
    const gl = renderer.getContext();

    // Create a floating-point texture
    const floatTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, floatTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create a framebuffer and attach the texture
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, floatTexture, 0);

    // Check the framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    // Cleanup
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(floatTexture);
    gl.deleteFramebuffer(framebuffer);

    // Return whether rendering to float is supported
    return status === gl.FRAMEBUFFER_COMPLETE;
  }
}

export const glitzController = new GlitzController();