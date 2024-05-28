import { useEffect, useRef } from 'preact/hooks';
// import { filer } from './core/fileStore';
import Dropzone from 'dropzone';
import 'dropzone/dist/dropzone.css'; // Import the CSS for Dropzone


export const DropzoneComponent = () => {
    const dropzoneRef = useRef(null);
    
    useEffect(() => {
        // Ensure Dropzone does not auto discover any elements to prevent double initialization.
        Dropzone.autoDiscover = false;

        // Initialize the Dropzone on the ref element
        const dz = new Dropzone(dropzoneRef.current!, {
            url: '/file/post', // Set the URL for file upload
            // paramName: 'file', // The name that will be used to transfer the file
            maxFilesize: 200, // MB
            maxFiles: 10,
            autoProcessQueue: false,
            //acceptedFiles: 'image/*',
            addRemoveLinks: true,

            init: function() {
                this.on("addedfile", file => {
                    console.log("Added file:", file);
                    // filer.importFile(file);
                });
                this.on("removedfile", file => {
                    console.log("Removed file:", file);
                });
            }
        });

        // Cleanup function to destroy Dropzone instance when component unmounts
        return () => {
            dz.destroy();
        };
    }, []);

    return (
      <>
        <div ref={dropzoneRef} className="dropzone bg-gray-500 hover:bg-purple-200 opacity-70 hover:opacity-80 text-grey-200 bg-red cursor-not-allowed" >
            <div class="dz-message" data-dz-message><span>File uploading is currently disabled.</span></div>
        </div>
      </>
    );
};
