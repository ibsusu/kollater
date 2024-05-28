// import { sleep } from "./utils";     
const workletProcessorUrl = "/js/noiseProcessor.js";
const defaultMusicUrl = '/audio/a_corp.ogg';


/**
 * Notes for future forgetful me ----
 * HOW THIS THING WORKS:
 * this class creates a worklet that proceses the audio channels, the max volume is calc'd that way
 * the frequency analysis happens on the main thread.  It cannot be done on the worker thread, it's part of the standard
 * there are two mutexes. one is for the workletnode and the other is for whatever is using the audio controller.
 * it expects the messages to come from the message port that's passed in on initialization.
 * the workletnode is initialized when the shared buffers are passed to the audio controller
 * the reason there is basically a ping/pong connection request is because we need to know 
 * the analyserNode.frequencyBinCount for the size of the shared buffers.  it can vary by machine/browser or just future updates
 * let's goo
 * 
 */
export class AudioController {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode!: GainNode;
  private analyserNode!: AnalyserNode;
  private workletNode!: AudioWorkletNode;
  private pausedAt: number = 0;
  private startTime!: number;
  isPlaying: boolean = false;
  private messagePort?: MessagePort;
  private mutexBuffer!: SharedArrayBuffer;
  private mutex!: Int32Array;
  private byteFreqs: Uint8Array;
  volumeBuffer!: SharedArrayBuffer// shared buffers require secure context. we always run on https
  soundBuffer!: SharedArrayBuffer;
  volumeArray!: Uint8Array;
  soundArray!: Float32Array;
  soundArraySwapper!: Float32Array;

  constructor() {
    this.audioContext = new AudioContext();
    this.analyserNode = this.audioContext.createAnalyser();
    this.byteFreqs = new Uint8Array(this.analyserNode.frequencyBinCount);
  }

  async init(url: string=defaultMusicUrl, messagePort?: MessagePort): Promise<void> {
    // Load the Audio Worklet module
    await this.audioContext.audioWorklet.addModule(workletProcessorUrl);

    // Create an AudioWorkletNode
    this.workletNode = new AudioWorkletNode(this.audioContext, 'noise-processor');
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
      this.soundArray = new Float32Array(this.soundBuffer);

      // we initialize the workletNode here because we don't have the volume buffer until sharedBuffers are transfered.
      
      this.workletNode.port.postMessage({
        reason: 'initialize',
        mutexBuffer: this.mutexBuffer,
        volumeBuffer: this.volumeBuffer
      });
     
      this.soundArraySwapper = new Float32Array(this.soundArray.length);
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
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1;
    // Connect the nodes
    
    // this stuff happens in order analyser -> worklet, gain. 
    // if gain is put first you can mute everything past it.
    this.sourceNode
      .connect(this.analyserNode)
      .connect(this.workletNode)
      .connect(this.gainNode)
      .connect(this.audioContext.destination);

    // Start playback
    this.sourceNode.start(0, this.pausedAt);

    this.startTime = this.audioContext.currentTime - this.pausedAt;
    
    this.sourceNode.onended = (_ev) => {
      this.isPlaying = false;
    }

    this.analyseAudio();
  }

  analyseAudio(){
    const mutexMask = Atomics.load(this.mutex, 0);
    // console.log({mutexMask});
    if(!(mutexMask & 0x1)){
      // console.log("AudioController", {mutex: this.mutex});
      // we use getByteFrequency data solely for getting the volume max, and it's only usable on the main thread.
      // if there's a better way to do this someone please let me know.
      // i didn't want to do frequency analysis on the worker in js or wasm when it's already native.
      this.analyserNode.getByteFrequencyData(this.byteFreqs);
      this.getVolumeMax(this.byteFreqs);
      
      this.analyserNode.getFloatFrequencyData(this.soundArraySwapper);
      this.soundArray.set(this.soundArraySwapper);
      // console.log("analyseAudio", this.soundArray);

      Atomics.or(this.mutex, 0, 0x1);
    }
    if(this.isPlaying){
      this.analyserNode.getFloatFrequencyData(this.soundArraySwapper);
      // this.soundArray.set(this.soundArraySwapper);
      // console.log("analyseAudio2", this.soundArraySwapper);
      requestAnimationFrame(this.analyseAudio.bind(this));
    }
  }

  getVolumeMax(audioBuffer: Uint8Array){
    this.volumeArray[3] = Math.floor(audioBuffer.reduce((acc, cur) => cur > acc? cur: acc, 0) % 256);
  }

  toggleMute() {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value === 0 ? 1 : 0;
    }
  }

  async play() {
    if (this.audioBuffer && !this.isPlaying) {
      this.analyze(); // Assume you have a way to provide the correct MessagePort
      // await sleep(3000);
      // this.pause();
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