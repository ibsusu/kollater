
import './app.css'
import {DropzoneComponent} from './dropzone';
import {init, useCore} from './core/core';
import {slogan} from './core/utils';
import { FileList } from './fileList';
init();

export function App() {
  const initialized = useCore();
  console.log("app", {initialized});
  return (
    initialized ?
      (
        <>
          <h1>KOLLATOR</h1>
          <div class="p-2">
            <DropzoneComponent />
          </div>
          <p class="read-the-docs">
            {slogan()}
          </p>
          <FileList title={'Cached Files'}/>
        </>
      ) : 
      <>ahoy</>
  )
    
  
}
