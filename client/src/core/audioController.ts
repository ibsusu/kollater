import { sleep } from "./utils";

const workletProcessorUrl = "/js/noiseProcessor.js";
const defaultMusicUrl = '/audio/a_corp.ogg';

export class AudioController {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode!: GainNode;
  private analyserNode!: AnalyserNode;
  private workletNode: AudioWorkletNode | null = null;
  private pausedAt: number = 0;
  private startTime!: number;
  isPlaying: boolean = false;
  private messagePort?: MessagePort;
  private maxSample: any = 0;
  private maxDif: number = 0;
  private sum: number = 0;
  private workletMutexBuffer: SharedArrayBuffer = new SharedArrayBuffer(4);
  private workletMutex!: Int32Array;
  private mutexBuffer!: SharedArrayBuffer;
  private mutex!: Int32Array;
  volumeBuffer!: SharedArrayBuffer// shared buffers require secure context. we always run on https
  soundBuffer!: SharedArrayBuffer;
  floatSoundBuffer!: SharedArrayBuffer;
  floatSoundArray!: Float32Array;
  volumeArray!: Uint8Array;
  soundArray!: Uint8Array;
  soundArraySwapper!: Uint8Array;
  // these two sharedArrayBuffers go to the worklet go to the audio worklet
  private audioChannelBufferLeft: SharedArrayBuffer;
  private audioChannelBufferRight: SharedArrayBuffer;
  

  constructor() {
    this.audioContext = new AudioContext();
    this.audioChannelBufferLeft = new SharedArrayBuffer(4096);
    this.audioChannelBufferRight = new SharedArrayBuffer(4096);
    this.workletMutex = new Int32Array(this.workletMutexBuffer);
    this.analyserNode = this.audioContext.createAnalyser();
  }

  async init(url: string=defaultMusicUrl, messagePort?: MessagePort): Promise<void> {
    this.messagePort = messagePort;
    if(this.messagePort){
      this.messagePort.onmessage = this.handleWorkerMessage.bind(this);
      console.log("audiocontroller checking messageport", this.messagePort);
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
  }

  firstStart() {
    this.play();
    window.removeEventListener('mousedown', audioController.firstStart.bind(this));
  }

  handleWorkerMessage(ev: MessageEvent) {
    console.log("handleWorkerMessage", ev);
    if(ev.data.reason === 'audioConnectionRequest'){
      this.messagePort!.postMessage({reason: 'audioConnected',  frequencyBinCount: this.analyserNode.frequencyBinCount});
    }
    else if(ev.data.reason === 'sharedBuffers'){
      this.mutexBuffer = ev.data.mutexBuffer;
      this.mutex = new Int32Array(this.mutexBuffer);
      this.volumeBuffer = ev.data.volumeBuffer;
      this.volumeArray = new Uint8Array(this.volumeBuffer)
      this.soundBuffer = ev.data.soundBuffer;
      this.soundArray = new Uint8Array(this.soundBuffer);
      if(ev.data.floatSoundBuffer){
        this.floatSoundBuffer = ev.data.floatSoundBuffer;
        this.floatSoundArray = new Float32Array(this.floatSoundBuffer);
      }
      this.soundArraySwapper = new Uint8Array(this.soundArray.byteLength);
      console.log("sharedbuffer message received", this.messagePort);
    }
  }

  async analyze(workerPort?: MessagePort): Promise<void> {
    if(workerPort) this.messagePort = workerPort;
    if(this.isPlaying) return;
    this.isPlaying = true;
    console.log("isPlaying", this.isPlaying);
    this.startTime = Date.now();
    if (!this.audioBuffer) {
      console.error("Audio not loaded");
      return;
    }

    // Ensure the audio context is resumed
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Load the Audio Worklet module
    await this.audioContext.audioWorklet.addModule(workletProcessorUrl);

    // Create an AudioWorkletNode
    // this.workletNode = new AudioWorkletNode(this.audioContext, 'noise-processor');
    // this.workletNode.port.postMessage({
    //   reason: 'initialize',
    //   // mutexBuffer: this.workletMutexBuffer,
    // });

    if(this.messagePort){
      // this.workletNode.port.postMessage({reason: 'initialize', }, [this.messagePort]);
      this.messagePort.onmessage = this.handleWorkerMessage.bind(this);
    }
    
    // this.workletNode.port.postMessage()

    // Create an AudioBufferSourceNode
    this.sourceNode = this.audioContext.createBufferSource();
    // set the audio buffer that we fetched as the sourceNode's input buffer
    this.sourceNode.buffer = this.audioBuffer;
    this.analyserNode.fftSize = 2048;  // defaults to 2048 but we're going to explicitly set it.
    const bufferLength = this.analyserNode.frequencyBinCount; // should be half the fftSize, so 1024
    console.log("BUFFERLENGTH", bufferLength);
    const dataArray = new Uint8Array(bufferLength);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0;
    // Connect the nodes
    
    this.sourceNode
      .connect(this.analyserNode)
      .connect(this.gainNode)
      // .connect(this.workletNode)
      .connect(this.audioContext.destination);

    // Start playback
    this.sourceNode.start(0, this.pausedAt);

    this.startTime = this.audioContext.currentTime - this.pausedAt;
    
    this.sourceNode.onended = (ev) => {
      this.isPlaying = false;
    }

    this.analyseAudio();


    // this is a bit roundabout but it's modern and not deprecated so whatever.
    // 1. start the audio data processing,
    // 2. worklet processes it, get's the bytes, sends the input to the output and sends back the bytes to here: the main thread.
    // 3. main thread uses the bytes in the anaylyser for frequency data WHICH CAN ONLY RUN ON THE MAIN THREAD then sends that data to the worker
    // 4. worker does cool graphics stuff with the data.
    // ...just kinda weird I guess
    // this.workletNode.port.onmessage = (event) => {
    //   console.log("main thread data", event.data);
    //   // this.analyserNode.getByteFrequencyData(event.data);
    //   Atomics.notify(this.mutex, 0);
    //   this.analyserNode.getByteFrequencyData(this.soundArray);
    //   // this.messagePort!.postMessage()
    // };
  }

  analyseAudio(){
    //@ts-ignore
    if(Atomics.load(this.mutex, 0) === 0){
      console.log({mutex: this.mutex});
      this.analyserNode.getByteFrequencyData(this.soundArraySwapper);
      console.log("analyseAudio", this.soundArray);
      this.soundArray.set(this.soundArraySwapper);
      Atomics.store(this.mutex, 0, 1);
    }
    if(this.isPlaying){
      requestAnimationFrame(this.analyseAudio.bind(this));
    }
  }

  saveMaxSample(e: any){ // TODO,
    const buf = e.inputBuffer.getChannelData(0);
    const len = buf.length;
    var last = buf[0];
    var max = buf[0];
    var maxDif = 0;
    var sum = 0;
    for (var ii = 1; ii < len; ++ii) {
      var v = buf[ii];
      if (v > max) {
        v = max;
      }
      var dif = Math.abs(v - last);
      if (dif > maxDif) {
        maxDif = dif;
      }
      sum += v * v;
    }
    this.maxSample = max;
    this.maxDif = maxDif;
    this.sum = Math.sqrt(sum / len);
  }

  toggleMute() {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value === 0 ? 1 : 0;
    }
  }

  async play() {
    if (this.audioBuffer && !this.isPlaying) {
      this.analyze(); // Assume you have a way to provide the correct MessagePort
      await sleep(3000);
      this.pause();
    }
  }

  pause(): void {
    if (this.sourceNode && this.isPlaying) {
      console.log("PAUSING");
      this.sourceNode.stop();
      this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.isPlaying = false;
    }
  }
}

const audioController = new AudioController();

window.addEventListener('mousedown', audioController.firstStart.bind(audioController));


export {audioController};