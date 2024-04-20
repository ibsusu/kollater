// import { hashers } from "./salt";
export async function processFile(inputFile: File) {
  if (!inputFile) {
      alert("Please select a file first.");
      return;
  }

  const file = inputFile;
  const chunkSize = 5 * 1024 * 1024; // 5 MB chunks
  let offset = 0;
  const leafHashes = [];

  while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const hash = await hashChunk(chunk);
      leafHashes.push(hash);
      // temporarily not saving for testing and dev
      // await saveChunkToOPFS(chunk, hash);
      offset += chunkSize;
  }

  const merkleRoot = await generateMerkleRoot(leafHashes);
  console.log('Merkle Root:', merkleRoot);
}

async function hashChunk(chunk: Blob) {
  const buffer = await chunk.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// async function saveChunkToOPFS(chunk: Blob, hash: string) {
//   const directoryHandle = await window.showDirectoryPicker();
//   const fileHandle = await directoryHandle.getFileHandle(hash, { create: true });
//   const writable = await fileHandle.createWritable();
//   const blob = new Blob([chunk], { type: 'application/octet-stream' });
//   await writable.write(blob);
//   await writable.close();
// }

//@ts-ignore
async function generateMerkleRoot(hashes) {
  if (hashes.length === 1) return hashes[0];
  const newHashes = [];
  for (let i = 0; i < hashes.length; i += 2) {
      const hash1 = hashes[i];
      const hash2 = hashes[i + 1] || hash1;
      const parentHash = await hashPair(hash1, hash2);
      newHashes.push(parentHash);
  }
  return generateMerkleRoot(newHashes);
}

//@ts-ignore
async function hashPair(hash1, hash2) {
  const encoder = new TextEncoder();
  const data = encoder.encode(hash1 + hash2);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}