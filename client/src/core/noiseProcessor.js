
class NoiseProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input) {
      const inputChannel = input[0];
      this.port.postMessage(inputChannel.slice(0)); // Send audio data to the main thread
    }
    return true;
  }
}

console.log("registering");
registerProcessor('noise-processor', NoiseProcessor);
