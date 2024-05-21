
const workletProcessorUrl = "/js/noiseProcessor.js";
const defaultMusicUrl = '/audio/a_corp.ogg';

export class AudioController {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode!: GainNode;
  private workletNode: AudioWorkletNode | null = null;
  private pausedAt: number = 0;
  private startTime!: number;
  isPlaying: boolean = false;
  private messagePort?: MessagePort;

  constructor() {
    this.audioContext = new AudioContext();
  }

  async init(url: string=defaultMusicUrl, messagePort?: MessagePort): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.messagePort = messagePort;
  }

  firstStart() {
    this.play();
    window.removeEventListener('mousedown', audioController.firstStart.bind(this));
  }

  async analyze(workerPort?: MessagePort): Promise<void> {
    if(workerPort) this.messagePort = workerPort;
    if(this.isPlaying) return;
    this.isPlaying = true;
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
    this.workletNode = new AudioWorkletNode(this.audioContext, 'noise-processor');
    if(this.messagePort){
      this.workletNode.port.postMessage('initialize', [this.messagePort]);
    }

    this.workletNode.port.onmessage = (event) => {
      // console.log(event.data); // Log audio data to the console
    };

    // Create an AudioBufferSourceNode
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Connect the nodes
    this.gainNode = this.audioContext.createGain();
    this.sourceNode
      .connect(this.gainNode)
      .connect(this.workletNode)
      .connect(this.audioContext.destination);

    // Start playback
 this.sourceNode.start(0, this.pausedAt);
    this.startTime = this.audioContext.currentTime - this.pausedAt;
    this.sourceNode.onended = (ev) => {
      this.isPlaying = false;
    }

  }

  toggleMute() {
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainNode.gain.value === 0 ? 1 : 0;
    }
  }

  play() {
    if (this.audioBuffer && !this.isPlaying) {
      this.analyze(); // Assume you have a way to provide the correct MessagePort
    }
  }

  pause(): void {
    if (this.sourceNode && this.isPlaying) {
      this.sourceNode.stop();
      this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.isPlaying = false;
    }
  }
}

const audioController = new AudioController();

window.addEventListener('mousedown', audioController.firstStart.bind(audioController));


export {audioController};