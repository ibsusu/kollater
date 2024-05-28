import { Renderer } from 'ogl';
import Scene from './scene';
export class GlitzController {
  //@ts-ignore
  private renderer!: Renderer;
  private scene!: Scene;
  private gl!: WebGLRenderingContext;
  private mutexBuffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private mutex!: Int32Array;
  private autoRender = { value: true };
  private mouse = { baseX: -.1, x: 0, baseY: 0, y: 0 };
  private maxTextureSize!: number;
  private canHandleFloat = false;
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

    this.scene = new Scene({canvas: data.canvas, width, height, pixelRatio, pointer: this.mouse});
    console.log('init scene called', pixelRatio);
    this.renderer = this.scene.renderer;
    this.gl = this.scene.renderer.gl;
    this.canHandleFloat = true;
    const canRenderToFloat = true;
    this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);

    console.log({canHandleFloat: this.canHandleFloat, canRenderToFloat});

    this.checkForAudioConnection();
    // this.loop();
    return {
      resize: this.resize.bind(this),
      autoRender: this.autoRender,
      mouse: this.mouse,
    };
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
    if(ev.data.reason === 'audioConnected' && !this.connectedAudio){
      this.connectedAudio = true;
      this.scene.canHandleFloat = this.canHandleFloat;
      console.log('bincount and maxtexturesize', {binCount: ev.data.frequencyBinCount, maxtsize: this.maxTextureSize});
      this.scene.sharedData.sound = new SharedArrayBuffer(Math.min(this.maxTextureSize, ev.data.frequencyBinCount)*4);
      this.scene.init();
      this.sendSharedBuffers();
    }
  }

  connectToAudio(){
    this.messagePort.postMessage({reason: 'audioConnectionRequest'});
  }

  sendSharedBuffers(){
    this.messagePort.postMessage({
      reason: "sharedBuffers",
      mutexBuffer: this.scene.sharedData.mutex,
      volumeBuffer: this.scene.sharedData.volume,
      soundBuffer: this.scene.sharedData.sound,
    });
  }

  resize() {
    console.log("resizing");
    // Implement the three.js method to resize the renderer and adjust camera perspective
  }

  // private checkCanHandleFloat(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  //   console.log("checkCanUseFloat", gl, gl.getExtension("OES_texture_float"));
  //   return gl.getExtension("OES_texture_float") ? true : false;
  // }

  // private checkCanRenderToFloat(renderer: Renderer) {
  //   const gl = renderer.gl;

  //   // Create a floating-point texture
  //   const floatTexture = gl.createTexture();
  //   gl.bindTexture(gl.TEXTURE_2D, floatTexture);
  //   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  //   // Create a framebuffer and attach the texture
  //   const framebuffer = gl.createFramebuffer();
  //   gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  //   gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, floatTexture, 0);

  //   // Check the framebuffer status
  //   const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  //   // Cleanup
  //   gl.bindTexture(gl.TEXTURE_2D, null);
  //   gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  //   gl.deleteTexture(floatTexture);
  //   gl.deleteFramebuffer(framebuffer);

  //   // Return whether rendering to float is supported
  //   return status === gl.FRAMEBUFFER_COMPLETE;
  // }
}

export const glitzController = new GlitzController();