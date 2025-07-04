import {glitzController} from './glitzController';
import {UIController} from './uiController';

class ProxyManager {
  targets: Record<number, UIController>;

  constructor() {
    this.targets = {};
    this.handleEvent = this.handleEvent.bind(this);
  }
  makeProxy(data: any) {
    const {id} = data;
    const proxy = new UIController();
    this.targets[id] = proxy;
  }
  getProxy(id: number) {
    return this.targets[id];
  }

  handleEvent(event: any) {
    // console.log("target", this.targets, event);
    this.targets[event.id].handleEvent(event.data);
  }
}

const proxyManager = new ProxyManager();

async function start(data: any) {
  console.log("glitzworker starting");
  const proxy = proxyManager.getProxy(data.canvasId);
  proxy.canvas = data.canvas;
  //@ts-ignore
  proxy.ownerDocument = proxy; // HACK!
  //@ts-ignore
  self.document = {};  // HACK!

  proxy.glitzern.push(await glitzController.init({
    element: proxy,
    canvas: data.canvas,
    inputElement: proxy,
    innerWidth: data.innerWidth,
    innerHeight: data.innerHeight,
    screenWidth: data.screenWidth,
    screenHeight: data.screenHeight,
    devicePixelRatio: data.devicePixelRatio
  }));
}

function makeProxy(data: any) {
  proxyManager.makeProxy(data);
}

const handlers = {
  start,
  makeProxy,
  event: proxyManager.handleEvent,
};

self.onmessage = function(e) {
  //@ts-ignore
  const fn = handlers[e.data.type];

  if (typeof fn !== 'function') {
    if(e.data?.reason === 'initialize'){
      let port = e.data.port;
      glitzController.setPort(port);
      return;
    }

    throw new Error('no handler for type: ' + e.data.type);
  }
  

  fn(e.data);
};
