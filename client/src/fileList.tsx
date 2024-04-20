import { filer, useFiler } from "./core/fileStore"


export function FileList({title}: {title: string}) {
  const files = useFiler();

  return (
    <>
      {files.length !== 0 && <p>{title}</p>}
      <ul class="list-none">
        {files.map(file => <li onClick={() => filer.exportFile(file.hash) } key={file.hash}>{file.name}</li>)}
      </ul>
    </>
  )
}