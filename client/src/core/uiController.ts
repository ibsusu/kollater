function noop() {
}

export class UIController {
  glitzern: any[];
  width!: number;
  height!: number;
  canvas: any;
  left!: number;
  top!: number;

  constructor(canvas?:any) {
    this.glitzern = [];
    this.canvas = canvas;
  }

  getBoundingClientRect() {
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      right: this.left + this.width,
      bottom: this.top + this.height,
    };
  }

  mouseHandler (event:any) {
    // console.log("mousehandler", this, event);
    this.startRender();
    for(let glitz of this.glitzern){
      glitz.mouse.x = (-event.clientX*2+this.width) / this.width;
      glitz.mouse.y = (event.clientY*2-this.height)/ this.height;
      // glitz.program.uniforms.iMouse.value[0] = (-event.clientX*2+this.width) / this.width;
      // glitz.program.uniforms.iMouse.value[1] = (event.clientY*2-this.height)/(this.height);
    }
  }

  sizeHandler (data: any) {
    console.log("resizeHandler", this, data);
    // console.log("worker size event", this);
    console.log("worker size event wh", this.width, this.height, this.canvas?.width, this.canvas?.height)
    this.left = data.left;
    this.top = data.top;
    this.width = data.width;
    this.height = data.height;
    if(this.canvas){
      this.canvas.width = data.width;
      this.canvas.height = data.height;
      console.log("worker size event wh", this, this.width, this.height, this.canvas?.width, this.canvas?.height)
      for(let glitz of this.glitzern){
        glitz.program.uniforms.uResolution.x = this.width;
        glitz.program.uniforms.uResolution.y = this.height;
        glitz.program.gl.renderer.setSize(this.width, this.height);
      }
      // this.stopRender();
    }
  }

  wheelHandler(_event:any){
    console.log("wheelHandler");
  }

  keyHandler (event:any){
    console.log("keyHandler", event);
    // console.log("keyhandler", event, this.glitzern[0].text);
    // this.glitzern[0].text.update({text: "hello"})
  }

  stopRender() {
    for(let glitz of this.glitzern){
      glitz.autoRender.value = false;
    } 
  }

  startRender(){
    for(let glitz of this.glitzern){
      //console.log("startRender glitz", glitz);
      if(!glitz.autoRender.value){
        glitz.autoRender.value = true;
        glitz.render();
      }
    }
  }

  handleEvent(data:any) {
    // console.log("handleEvent", data);
    if (data.type === 'size') {
      this.sizeHandler(data);
      return;
    }
    data.preventDefault = noop;
    data.stopPropagation = noop;
    switch(data.type){
      case 'pointermove':
        // console.log("pointer movedata", data);
        this.mouseHandler(data);
        break;
      case 'keydown':
        this.keyHandler(data);
        break;
      default:
        // console.log("default handler", data);
        break;
    }
  }
  focus() {
    // no-op
  }
}
