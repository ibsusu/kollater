import { WebGLRenderer, LinearFilter, NearestFilter, FloatType, AlphaFormat } from 'three';
import { HistoryTexture } from './HistoryTexture';
import Scene from './scene';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GlitzController {
  private renderer: WebGLRenderer | null = null;
  private context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private mutexBuffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private mutex!: Int32Array;
  private volumeHistory: HistoryTexture | null = null;
  private soundHistory: HistoryTexture | null = null;
  private floatSoundHistory: HistoryTexture | null = null;
  private autoRender = { value: true };
  private mouse = { baseX: -.1, x: 0, baseY: 0, y: 0 };
  private maxTextureSize!: number;
  messagePort!: MessagePort;
  connectedAudio: boolean = false;
  audioCheckInterval!: number;
  constructor() {}

  async init(data: any) {
    console.log("glitzcontroller data", {data});
    this.mutex = new Int32Array(this.mutexBuffer);
    Atomics.store(this.mutex, 0, 1);
    const width = data.innerWidth;
    const height = data.innerHeight;
    const pixelRatio = data.devicePixelRatio;

    const scene = new Scene();
    console.log('init scene called');
    this.renderer = await scene.init(data.canvas, width, height, pixelRatio, './' );
    this.context = this.renderer.getContext();
    const canUseFloat = false;//this.checkCanUseFloat(this.context);
    const canRenderToFloat = false;//this.checkCanRenderToFloat(this.renderer);
    const canFilterFloat = canUseFloat && this.context.getExtension("OES_texture_float_linear");
    this.maxTextureSize = 1024; //this.context.MAX_TEXTURE_SIZE;
    const numSoundSamples = 128;//Math.min(this.maxTextureSize, 1024);
    const numHistorySamples = 60 * 4;
    
    this.volumeHistory = new HistoryTexture(this.renderer, {
      width: 4,
      length: numHistorySamples,
      format: AlphaFormat
    });
    scene.volumeHistory = this.volumeHistory

    this.soundHistory = new HistoryTexture(this.renderer, {
      width: numSoundSamples,
      length: numHistorySamples,
      format: AlphaFormat
    });
    scene.soundHistory = this.soundHistory;

    console.log({canUseFloat, canRenderToFloat});
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
      scene.floatSoundHistory = this.floatSoundHistory;
    }

    this.checkForAudioConnection();
    // this.loop();
    return {
      resize: this.resize.bind(this),
      autoRender: this.autoRender,
      mouse: this.mouse,
    };
  }

  async loop(){
    // console.log("loop");
    //@ts-ignore 2339
    // let res = Atomics.waitAsync(this.mutex, 0, 1);
    // console.log("loop res", await res.value);
    // console.log(this.soundHistory!.buffer);
    // Atomics.store(this.mutex, 0, 1);
    // sleep(100);
    // this.loop();
  }

  checkForAudioConnection() {
    if(!this.connectedAudio){
      this.audioCheckInterval = setInterval(() => {
        if(this.connectedAudio) {
          clearInterval(this.audioCheckInterval);
          return;
        }
        this.connectToAudio();
      }, 200) as unknown as number;
    }
  }
  setPort(messagePort: MessagePort){
    this.messagePort = messagePort;
    this.messagePort.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(ev: MessageEvent){
    console.log("glitzController handle Message", ev);
    if(ev.data.reason === 'audioConnected'){
      this.soundHistory!.sharedBuffer = new SharedArrayBuffer(Math.min(ev.data.frequencyBinCount, this.maxTextureSize));
      this.soundHistory!.sharedArray = new Uint8Array(this.soundHistory!.sharedBuffer);
      if(this.floatSoundHistory){
        //@ts-ignore ts(2339)
        this.floatSoundHistory.sharedBuffer = new SharedArrayBuffer(Math.min(ev.data.frequencyBinCount, this.maxTextureSize));
        this.floatSoundHistory.sharedArray = new Float32Array(this.floatSoundHistory.sharedBuffer);
      }
      this.connectedAudio = true;
      this.sendSharedBuffers();
    }
  }

  connectToAudio(){
    this.messagePort.postMessage({reason: 'audioConnectionRequest'});
  }

  sendSharedBuffers(){
    this.messagePort.postMessage({
      reason: "sharedBuffers",
      mutexBuffer: this.mutexBuffer,
      volumeBuffer: this.volumeHistory!.sharedBuffer,
      soundBuffer: this.soundHistory!.sharedBuffer,
      floatSoundBuffer: this.floatSoundHistory?.sharedBuffer,
    });
  }

  resize() {
    console.log("resizing");
    // Implement the three.js method to resize the renderer and adjust camera perspective
  }

  private checkCanUseFloat(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    console.log("checkCanUseFloat", gl, gl.getExtension("OES_texture_float"));
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