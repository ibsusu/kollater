let count = 0;
class NoiseProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
    this.port.onmessage = (event) => {
      console.log("worklet event", {event});
      if(event.data.reason === 'initialize'){
        console.log("worklet initialize");
        this.workerPort = event.ports[0];
        this.mutexBuffer = event.data.mutexBuffer;
        this.mutex = new Int32Array(this.mutexBuffer);
        this.volumeBuffer = event.data.volumeBuffer;
        this.volume = new Uint8Array(this.volumeBuffer);
      }
    }
  }
  /** 
   * type: inputs: Float32Array[2][], only index 0 is filled.
   * type: outputs: Float32Array[2][], only index 0 should be filled by inputs
   */
  process(inputs, outputs, _parameters) {
    let inputChannel = [];
    let inputChannel2 = [];
    // console.log("noiseprocessor process");
    const input = inputs[0];
    const output = outputs[0];
    let mutexMask = Atomics.load(this.mutex, 0);

    if(input && output){
      inputChannel = input[0];
      let outputChannel = output[0];
      if(inputChannel){
        outputChannel.set(inputChannel);
      }
      inputChannel2 = input[1];
      let outputChannel2 = output[1];
      if(inputChannel2){
        outputChannel2.set(inputChannel2);
      }

      if(!(mutexMask & 0x2)){
        if(inputChannel && inputChannel2){
          this.saveMaxSample(inputChannel, inputChannel2);
        }
        else if (inputChannel){
          this.saveMaxSample(inputChannel, undefined);
        }
        Atomics.or(this.mutex, 0, 0x2);
      }
    }
    return true;
  }
    
    // if (inputs[0] && outputs[0]) {
    //   inputChannel = input[0];
    //   inputChannel2 = input[1];
    //   const outputChannel = output[0];
    //   const outputChannel2 = output[1];
    //   let mutexMask = Atomics.load(this.mutex, 0);
      
    //   // null input skipping block
    //   if(!inputChannel || !inputChannel.length){
    //     // console.log("noise inputchannel is empty, or-ing mutex");
    //     if(!(mutexMask & 0x2)) {
    //       Atomics.or(this.mutex, 0, 0x2);
    //       // outputChannel = inputChannel;
    //       // outputChannel2 = inputChannel2;
    //     }
    //     return true;
    //   }

    //   // console.log("noise process", {mutex: this});
    //   if(!(mutexMask & 0x2)){
    //     // console.log('passed mutexMask');
    //     // for(let i=0;i<inputChannel.length;++i){
    //     //   outputChannel[i] = inputChannel[i];
    //     //   outputChannel2[i] = inputChannel2[i];
    //     // }
    //     // console.log('noise ')
    //     if(inputChannel2){
    //       this.saveMaxSample(inputChannel, inputChannel2, outputChannel, outputChannel2);
    //     }
    //     else{
    //       this.saveMaxSample(inputChannel, undefined, outputChannel, undefined);
    //     }
    //     Atomics.or(this.mutex, 0, 0x2);
    //   }
    //   else{
    //     // console.log({input});
    //     if(inputChannel2){
    //       for(let i=0;i<inputChannel.length;++i){
    //         outputChannel[i] = inputChannel[i];
    //         outputChannel2[i] = inputChannel2[i];
    //       }
    //     }
    //     else{
    //       for(let i=0;i<inputChannel.length;++i){
    //         outputChannel[i] = inputChannel[i];
    //       }
    //     }
    //   }
    // }

    // if(inputChannel.length){
    //   // if(this.workerPort) 
    //   //   this.workerPort.postMessage([inputChannel.slice(0), inputChannel2]); // Send audio data to the main thread
    //   // else
    //   // this.port.postMessage([inputChannel.slice(0), inputChannel2]); // Send audio data to the main thread
    // }

  

  saveMaxSample(channel1, channel2) {
    const buf1 = channel1;
    const len = buf1.length;
    let last1 = buf1[0];
    let max1 = buf1[0];
    let maxDif1 = 0;
    let sum1 = 0;
    
    if(channel2){
      const buf2 = channel2;
      let last2 = buf2[0];
      let max2 = buf2[0];
      let maxDif2 = 0;
      let sum2 = 0;
      for (let i = 1; i < len; ++i) {
        let v1 = buf1[i];
        if (v1 > max1) {
          v1 = max1;
        }
        let dif1 = Math.abs(v1 - last1);
        if (dif1 > maxDif1) {
          maxDif1 = dif1;
        }
        sum1 += v1 * v1;
    
        let v2 = buf2[i];
        if (v2 > max2) {
          v2 = max2;
        }
        let dif2 = Math.abs(v2 - last2);
        if (dif2 > maxDif2) {
          maxDif2 = dif2;
        }
        sum2 += v2 * v2;
      }
      // console.log("maxes", max1, max2);
      this.volume[0] = Math.max(max1, max2)*255;
      this.volume[1] = Math.max(Math.sqrt(sum1/len), Math.sqrt(sum2/len))*255;
      this.volume[2] = Math.max(maxDif1, maxDif2)*127;
      // console.log("setting volume in 2", {volume: this.volume});
      // return {
      //   maxSample1: max1,
      //   maxDif1: maxDif1,
      //   sum1: Math.sqrt(sum1 / len),
      //   maxSample2: max2,
      //   maxDif2: maxDif2,
      //   sum2: Math.sqrt(sum2 / len)
      // };
      return;
    }
    // this is only hit when it's a single channel of audio
    for (let i = 1; i < len; ++i) {
      let v1 = buf1[i];
      if (v1 > max1) {
        v1 = max1;
      }
      let dif1 = Math.abs(v1 - last1);
      if (dif1 > maxDif1) {
        maxDif1 = dif1;
      }
      sum1 += v1 * v1;
      // console.log("setting volume in 1", {volume: this.volume});

    }
    this.volume[0] = max1*255;
    this.volume[1] = Math.sqrt(sum1/len)*255;
    this.volume[2] = maxDif1*127;
    // return {
    //   maxSample1: max1,
    //   maxDif1: maxDif1,
    //   sum1: Math.sqrt(sum1 / len)
    // };
  }

}

registerProcessor('noise-processor', NoiseProcessor);
