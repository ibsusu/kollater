// import { hashers } from "./salt";

export async function* streamFileInChunks(file: File, chunkSize: number): AsyncGenerator<Uint8Array, void, unknown> {
  console.log({file});
  const reader = file.stream().getReader();
  let position = 0;
  let carryOver = new Uint8Array();

  while (position < file.size) {
    const { value, done } = await reader.read();
    if (done) {
      if (carryOver.byteLength > 0) {
        yield carryOver;
      }
      break;
    }

    let chunk = new Uint8Array(carryOver.byteLength + value.byteLength);
    chunk.set(carryOver);
    chunk.set(value, carryOver.byteLength);

    while (chunk.byteLength >= chunkSize) {
      const piece = chunk.subarray(0, chunkSize);
      yield piece;
      chunk = chunk.subarray(chunkSize);
    }

    console.log("setting carryOver", {chunk});
    carryOver = chunk;
    position += value.byteLength;
  }
  yield carryOver;
}

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
      // Save chunk to OPFS for verification
      await saveChunkToOPFS(chunk, hash);
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

async function saveChunkToOPFS(chunk: Blob, hash: string) {
  try {
    const directory = await navigator.storage.getDirectory();
    // Sanitize hash for OPFS filename compatibility
    const safeHash = hash.replace(/[^a-zA-Z0-9\-_]/g, '');
    const fileHandle = await directory.getFileHandle(safeHash, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(chunk);
    await writable.close();
    console.log(`Chunk saved to OPFS: ${safeHash} (original: ${hash})`);
  } catch (error) {
    console.error(`Failed to save chunk ${hash} to OPFS:`, error);
    throw error;
  }
}

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

async function hashPair(hash1: string, hash2: string): Promise<string> {
  const combinedString = hash1 + hash2;
  const encoder = new TextEncoder();
  const data = encoder.encode(combinedString);
  // Create a new ArrayBuffer from the Uint8Array to avoid type issues
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}
