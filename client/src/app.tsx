
import './app.css'
import {DropzoneComponent} from './dropzone';
import {init, useCore} from './core/core';
import {slogan} from './core/utils';
import { FileList } from './fileList';
init();

export function App() {
  const initialized = useCore();

  return (
    initialized ?
      (
        <>
          <h1 class="select-none text-white">KOLLATOR</h1>
          <div class="p-2 select-none">
            <DropzoneComponent />
          </div>
          <p class="read-the-docs select-none">
            {slogan()}
          </p>
          <FileList title={'Cached Files'}/>
        </>
      ) : 
      <>ahoy</>
  )
    
  
}
