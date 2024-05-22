let count = 0;
class NoiseProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
    this.port.onmessage = (event) => {
      console.log("worklet event", {event});
      if(event.data === 'initialize'){
        this.workerPort = event.ports[0];
      }
    }
  }
  /** 
   * type: inputs: Float32Array[2][], only index 0 is filled.
   * type: outputs: Float32Array[2][], only index 0 should be filled by inputs
   */
  process(inputs, outputs, parameters) {
    let inputChannel = [];
    let inputChannel2 = [];
    
    const input = inputs[0];
    const output = outputs[0];
    if (inputs[0] && outputs[0]) {
      inputChannel = input[0];
      inputChannel2 = input[1];
      const outputChannel = output[0];
      const outputChannel2 = output[1];

      for (let i = 0; i < inputChannel.length; i++) {
        outputChannel[i] = inputChannel[i]; // Pass the audio data through
        outputChannel2[i] = inputChannel2[i];
      }
    }

    if(inputChannel.length){
      if(this.workerPort) 
        this.workerPort.postMessage([inputChannel.slice(0), inputChannel2]); // Send audio data to the main thread
      else
        this.port.postMessage([inputChannel.slice(0), inputChannel2]); // Send audio data to the main thread
    }
    return true;
  }
}

registerProcessor('noise-processor', NoiseProcessor);
