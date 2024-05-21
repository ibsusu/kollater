import Scene from './scene';



// self.onmessage = function(message) {

//   const data = message.data;
//   init(data.drawingSurface, data.width, data.height, data.pixelRatio, data.path);
// };
// import {TextVertexShader, TextFragmentShader} from './TextShader';
// import {createTextProgram, initializeAlphabet} from './textLayout';
// import {createUniformBufferObject, updateUniformBufferObject} from './groupLayout';
// import KollatorShader from './KollatorShader';


export async function init(data: any) {
  console.log("glitzcontroller data", {data});
  const width = data.innerWidth;
  const height = data.innerHeight;
  const pixelRatio = data.devicePixelRatio;
  const sceneInstance = new Scene();

  console.log('init scene called');
  sceneInstance.init(data.canvas, width, height, pixelRatio, './' );
  const autoRender = {value: true};
  const mouse = {baseX: -.1, x: 0, baseY: 0, y: 0};


  function resize() {//TODO: get the threejs method
    console.log("resizing");
    // console.log("resizing", gl.canvas.width, gl.canvas.height);
    // renderer.setSize(window.innerWidth*dpr, window.innerHeight*dpr);
    // renderer.setSize(window.innerWidth/2, window.innerHeight/2);
    // camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
  }
  // const program;

  return {
    resize, 
    // program, 
    autoRender, 
    // render, 
    // textProgram, 
    mouse, 
    // groupVariables
  };
}

// self.onmessage = function ( message ) {

// 	const data = message.data;
// 	init( data.drawingSurface, data.width, data.height, data.pixelRatio, data.path );

// };