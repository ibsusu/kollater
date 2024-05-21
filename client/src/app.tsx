
import './app.css'
import {DropzoneComponent} from './dropzone';
import {init, useCore} from './core/core';
import {slogan} from './core/utils';
import { audioController } from './core/audioController';
import { FileList } from './fileList';
init();

export function App() {
  const initialized = useCore();
  console.log("app", {initialized});
  
  const handleAnalyzeClick = async () => {
    try {
      await audioController.analyze();
    } catch (error) {
      console.error('Error during audio analysis:', error);
    }
  };

  return (
    initialized ?
      (
        <>
          <h1 class="select-none">KOLLATOR</h1>
          <div class="p-2 select-none">
            <DropzoneComponent />
          </div>
          <button id="playButton" class="select-none" onClick={handleAnalyzeClick}>Analyze Audio</button>
          <p class="read-the-docs select-none">
            {slogan()}
          </p>
          <FileList title={'Cached Files'}/>
        </>
      ) : 
      <>ahoy</>
  )
    
  
}
