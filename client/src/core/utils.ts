export const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);



export const slogans = {
  "collect": [
    "Kumulate",
    "Kollekt",
    "Kompile"
  ],
  "organize": [
    "Kategorize",
    "Katolog",
    "Kurate"
  ],
  "communicate": [
    "Kommunikate",
    "Kaskade",
    "Konvey"
  ]
}

export const slogan = () => `${slogans.collect[Math.floor(Math.random() * (slogans.collect.length-1))]}, ${slogans.organize[Math.floor(Math.random() * (slogans.organize.length-1))]}, ${slogans.communicate[Math.floor(Math.random() * (slogans.communicate.length-1))]}`;


async function destroyDB() {
  clearDirectory(await navigator.storage.getDirectory());
}

async function clearDirectory(directoryHandle: FileSystemDirectoryHandle) {

  // Check if the handle has permission to read and write
  //@ts-ignore
  if ((await directoryHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      // Request permission
      //@ts-ignore
      if ((await directoryHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
          throw new Error('Permission to read and write the directory was not granted');
      }
  }

  // Create an async iterator to iterate over the files in the directory
  //@ts-ignore
  for await (const [name, entry] of directoryHandle.entries()) {
      if (entry.kind === 'file') {
          // Remove file
          await directoryHandle.removeEntry(name);
      } else if (entry.kind === 'directory') {
          // Optionally handle subdirectories
          // Use removeRecursively if available, or you might need to recursively clear the directory first
          if (entry.removeRecursively) {
              await entry.removeRecursively(); // This is non-standard but may be supported in some environments
          } else {
              await clearDirectory(entry); // Recursively clear subdirectory
              await directoryHandle.removeEntry(name, { recursive: true }); // Then remove it
          }
      }
  }
}

//@ts-ignore
window.destroyDB = destroyDB;