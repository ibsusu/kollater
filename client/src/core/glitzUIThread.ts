import {glitzController} from './glitzController.ts';
import {UIController} from './uiController.ts';
// import {type GlitzWorker} from './glitzWorker';
// export {type GlitzWorker} from './glitzWorker';
import GlitzWorker from './glitzWorker?worker';
import { audioController } from './audioController.ts';


const mouseEventHandler = makeSendPropertiesHandler([
  'ctrlKey',
  'metaKey',
  'shiftKey',
  'button',
  'pointerType',
  'clientX',
  'clientY',
  'pageX',
  'pageY',
]);

const wheelEventHandlerImpl = makeSendPropertiesHandler([
  'deltaX',
  'deltaY',
]);

const keydownEventHandler = makeSendPropertiesHandler([
  'ctrlKey',
  'metaKey',
  'shiftKey',
  'keyCode',
]);

function wheelEventHandler(event: any, sendFn: any) {
  event.preventDefault();
  wheelEventHandlerImpl(event, sendFn);
}

function preventDefaultHandler(event: any) {
  event.preventDefault();
}

function copyProperties(src: any, properties: any, dst: any) {
  for (const name of properties) {
      dst[name] = src[name];
  }
}

function makeSendPropertiesHandler(properties: any) {

  return function sendProperties(event: any, sendFn: any) {
    const data = {type: event.type};
    copyProperties(event, properties, data);
    sendFn(data);
  };
}

function touchEventHandler(event: any, sendFn: any) {
  const touches: any[] = [];
  const data = {type: event.type, touches};
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touches.push({
      pageX: touch.pageX,
      pageY: touch.pageY,
    });
  }
  sendFn(data);
}

// The four arrow keys
const orbitKeys = {
  '37': true,  // left
  '38': true,  // up
  '39': true,  // right
  '40': true,  // down
};
function filteredKeydownEventHandler(event: any, sendFn: any) {
  // console.log("filtered keydowneventhandler", event, sendFn);
  const {keyCode} = event;
  keydownEventHandler(event, sendFn);

  // if (orbitKeys[keyCode]) {
  //   event.preventDefault();
  //   keydownEventHandler(event, sendFn);
  // }
}

let nextProxyId = 0;

class ElementProxy {
  worker: any;
  id: number;

  constructor(element: any, worker: any, eventHandlers: any) {
    this.id = nextProxyId++;
    this.worker = worker;
    const sendEvent = (data: any) => {
      this.worker.postMessage({
        type: 'event',
        id: this.id,
        data,
      });
    };

    // register an id
    worker.postMessage({
      type: 'makeProxy',
      id: this.id,
    });
    sendSize();

    for (const [eventName, handler] of Object.entries(eventHandlers)) {
      // console.log("addeventListener", element, eventName);
      if(eventName === 'pointerUp') 
      element.addEventListener(eventName, function(event: any) {
        //@ts-ignore
        handler(event, sendEvent);
      });
    }

    function sendSize() {
      // const rect = element.getBoundingClientRect();
      const rect = {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
      sendEvent({
        type: 'size',
        left: rect.left,
        top: rect.top,
        width: window.innerWidth,
        height: window.innerHeight,
        // width: element.clientWidth,
        // height: element.clientHeight,
      });
    }

    // really need to use ResizeObserver
    window.addEventListener('resize', sendSize);
    window.addEventListener('fullscreenchange', sendSize);
  }

  sendEvent(data: any) {
    this.worker.postMessage({
      type: 'event',
      id: this.id,
      data,
    });
  };

}

export function startWorker(canvas: HTMLCanvasElement, messagePort: MessagePort) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.focus();
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new GlitzWorker();
  worker.postMessage({reason: 'initialize',  port: messagePort }, [messagePort]);

  const eventHandlers = {
    // contextmenu: preventDefaultHandler,
    // mousedown: mouseEventHandler,
    // mousemove: mouseEventHandler,
    // mouseup: mouseEventHandler,
    pointerdown: mouseEventHandler,
    pointermove: mouseEventHandler,
    pointerup: mouseEventHandler,
    // touchstart: touchEventHandler,
    // touchmove: touchEventHandler,
    // touchend: touchEventHandler,
    wheel: wheelEventHandler,
    keydown: filteredKeydownEventHandler,
  };

  const proxy = new ElementProxy(window, worker, eventHandlers);
  // const proxy = new ElementProxy(canvas, worker, eventHandlers);
  const msg = {
    type: 'start',
    canvas: offscreen,
    canvasId: proxy.id,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio
  };
  

  worker.postMessage(msg, [offscreen]);
  // window.addEventListener('fullscreenchange', event => {
  //   console.log("fullscreenchange");
  //   sendSize();
  // });
}

export async function startMainPage(canvas: HTMLCanvasElement, messagePort: MessagePort) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.focus();

  const controller = new UIController();
  messagePort.onmessage = (e) => {
    console.log("worker received audio data", e.data);
  }

  controller.width = canvas.width;
  controller.height = canvas.height;

  // console.log("controller wh, window wh", controller.width, controller.height, window.innerWidth, window.innerHeight);
  controller.glitzern.push(await glitzController.init({
    element: window,
    canvas,
    inputElement: canvas,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio
  }));
  const eventHandlers = {
    // contextmenu: preventDefaultHandler,
    // mousedown: mouseEventHandler,
    // mousemove: mouseEventHandler,
    // mouseup: mouseEventHandler,
    pointerdown: controller.mouseHandler,
    pointermove: controller.mouseHandler,
    pointerup: controller.mouseHandler,
    // touchstart: touchEventHandler,
    // touchmove: touchEventHandler,
    // touchend: touchEventHandler,
    wheel: controller.wheelHandler,
    keydown: controller.keyHandler,
  };

  for (const [eventName, handler] of Object.entries(eventHandlers)) {
    window.addEventListener(eventName, handler.bind(controller));
  }

  window.addEventListener('resize', (event) => {
    const rect = {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
    controller.sizeHandler(rect);
  });
  window.addEventListener('fullscreenchange', (event) => {
    const rect = {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
    controller.sizeHandler(rect);
  });
  window.addEventListener('webkitfullscreenchange', (event) => {
    const rect = {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
    controller.sizeHandler(rect);
  });

  console.log('using regular canvas');
}
