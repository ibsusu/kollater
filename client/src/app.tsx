
import './app.css'
import {DropzoneComponent} from './dropzone';
import {init, useCore} from './core/core';
import {slogan} from './core/utils';
import { FileList } from './fileList';
import { audioController } from './core/audioController';
import { useEffect, useState } from 'preact/hooks';
init();
const subtext = slogan();
export function App() {
  const initialized = useCore();
  const [isPlaying, setIsPlaying] = useState(audioController.isPlaying);

  function handleAudioControl() {
    if(isPlaying)
      audioController.pause();
    else
      audioController.play();
  }

  useEffect(() => {
    const handleIsPlaying = () => {
      setIsPlaying(true);
    };
    const handleIsPaused = () => {
      setIsPlaying(false);
    };
    window.addEventListener('audioPlaying', handleIsPlaying);
    window.addEventListener('audioPaused', handleIsPaused);
    return () => {
      window.removeEventListener('audioPlaying', handleIsPlaying);
      window.addEventListener('audioPaused', handleIsPaused);
    }
  }, []);

  return (
    initialized ?
      (
        <>
          <main class="w-full h-full relative flex flex-col items-center flex-col justify-center">
            <div class="fileArea">
              <h1 class="select-none text-white">KOLLATOR</h1>
              <div class="p-2 select-none">
                <DropzoneComponent />
              </div>
              <p class="read-the-docs select-none">
                {subtext}
              </p>
              <FileList title={'Cached Files'}/>
            </div>
            <button class="absolute bottom-0 right-0 w-16 h-16 rounded-full" onClick={handleAudioControl}>
              {isPlaying ? 
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
                :
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                </svg>
              }
            </button>
          </main>
        </>
      ) : 
      <>ahoy</>
  )
    
  
}
