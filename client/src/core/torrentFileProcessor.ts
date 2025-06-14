import { TorrentMetadata, MetaData, FileState, Database } from './fileTypes';
import { fromByteArray as bytesTob64 } from 'base64-js';

/**
 * TorrentFileProcessor - Creates standard BitTorrent v1/v2 hybrid torrents
 * 
 * Creates BitTorrent v1/v2 hybrid torrents with:
 * 1. Standard BitTorrent pieces (optimal size for torrent client compatibility)
 * 2. Optional Ed25519 signing for torrent authenticity
 */
export class TorrentFileProcessor {
  
  constructor(private database: Database) {}

  /**
   * Calculate optimal piece size for BitTorrent v1 compatibility
   * Based on file size to balance efficiency and metadata size
   */
  private calculateOptimalPieceSize(fileSize: number): number {
    if (fileSize < 50 * 1024 * 1024) return 256 * 1024;      // 256KB for files < 50MB
    if (fileSize < 500 * 1024 * 1024) return 512 * 1024;     // 512KB for files < 500MB
    if (fileSize < 2 * 1024 * 1024 * 1024) return 1024 * 1024; // 1MB for files < 2GB
    if (fileSize < 8 * 1024 * 1024 * 1024) return 2 * 1024 * 1024; // 2MB for files < 8GB
    return 4 * 1024 * 1024; // 4MB for larger files
  }

  /**
   * Generate Ed25519 key pair if not already present in database
   */
  private async ensureEd25519Keys(): Promise<void> {
    if (this.database.ed25519PublicKey && this.database.ed25519PrivateKey) {
      return; // Keys already exist
    }

    // Generate Ed25519 key pair using Web Crypto API
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519'
      },
      true, // extractable
      ['sign', 'verify']
    );

    // Export keys to base64
    const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    this.database.ed25519PublicKey = bytesTob64(new Uint8Array(publicKeyRaw));
    this.database.ed25519PrivateKey = bytesTob64(new Uint8Array(privateKeyRaw));
  }

  /**
   * Sign the torrent info dict with Ed25519 private key
   */
  private async signInfoDict(infoDict: any): Promise<string> {
    if (!this.database.ed25519PrivateKey) {
      throw new Error('No Ed25519 private key available for signing');
    }

    // Convert info dict to canonical JSON for signing
    const infoString = JSON.stringify(infoDict);
    const infoBytes = new TextEncoder().encode(infoString);

    // Import private key
    const privateKeyBytes = Uint8Array.from(atob(this.database.ed25519PrivateKey), c => c.charCodeAt(0));
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      {
        name: 'Ed25519',
        namedCurve: 'Ed25519'
      },
      false,
      ['sign']
    );

    // Sign the info dict
    const signature = await crypto.subtle.sign('Ed25519', privateKey, this.toArrayBuffer(infoBytes));
    return bytesTob64(new Uint8Array(signature));
  }

  /**
   * Stream file in chunks of specified size
   */
  private async* streamFileInChunks(file: File, chunkSize: number): AsyncGenerator<Uint8Array, void, unknown> {
    const reader = file.stream().getReader();
    let carryOver = new Uint8Array();

    while (true) {
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

      carryOver = chunk;
    }
  }

  /**
   * Helper function to convert Uint8Array to ArrayBuffer for crypto operations
   */
  private toArrayBuffer(uint8Array: Uint8Array): ArrayBuffer {
    return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer;
  }

  /**
   * Calculate merkle tree from SHA-256 hashes
   */
  private async calculateMerkleTree(hashes: Uint8Array[]): Promise<Uint8Array[][]> {
    let tree: Uint8Array[][] = [hashes];
    let currentLevel = hashes;

    while (currentLevel.length > 1) {
      const newLevel: Uint8Array[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = new Uint8Array(left.length + right.length);
        combined.set(left);
        combined.set(right, left.length);

        const newHash = await crypto.subtle.digest('SHA-256', combined);
        newLevel.push(new Uint8Array(newHash));
      }
      tree.push(newLevel);
      currentLevel = newLevel;
    }
    return tree;
  }

  /**
   * Store 5MiB chunks in OPFS using their SHA-256 hashes as filenames
   */
  private async storeKollatorChunks(chunks: Uint8Array[], hashes: string[]): Promise<void> {
    // Get OPFS root
    const opfsRoot = await navigator.storage.getDirectory();
    
    // Create chunks directory if it doesn't exist
    let chunksDir: FileSystemDirectoryHandle;
    try {
      chunksDir = await opfsRoot.getDirectoryHandle('chunks');
    } catch {
      chunksDir = await opfsRoot.getDirectoryHandle('chunks', { create: true });
    }

    // Store each chunk with its hash as filename
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const hash = hashes[i];
      
      // Use URL-safe base64 for filename
      const safeHash = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      console.log("TORRENTFILEPROCESSOR HASH",{safeHash, hash});
      
      const fileHandle = await chunksDir.getFileHandle(safeHash, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(this.toArrayBuffer(chunk));
      await writable.close();
    }
  }

  /**
   * Process file and create complete dual-chunking torrent metadata
   */
  async processFile(file: File, signTorrent: boolean = false): Promise<{ metadata: TorrentMetadata, kollatorChunks: string[] }> {
    // Calculate optimal piece size for BitTorrent compatibility
    const optimalPieceSize = this.calculateOptimalPieceSize(file.size);
    
    // Generate encryption key and IV
    const key = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const keyString = bytesTob64(key);
    const ivString = bytesTob64(iv);

    // Arrays to store hashes
    const sha1Pieces: Uint8Array[] = [];
    const sha256Pieces: Uint8Array[] = [];

    // Process BitTorrent pieces (optimal size)
    for await (const piece of this.streamFileInChunks(file, optimalPieceSize)) {
      const sha1Hash = await crypto.subtle.digest('SHA-1', this.toArrayBuffer(piece));
      const sha256Hash = await crypto.subtle.digest('SHA-256', this.toArrayBuffer(piece));
      sha1Pieces.push(new Uint8Array(sha1Hash));
      sha256Pieces.push(new Uint8Array(sha256Hash));
    }

    // Calculate merkle tree for BitTorrent v2
    const merkleTree = await this.calculateMerkleTree(sha256Pieces);
    const merkleRoot = merkleTree[merkleTree.length - 1][0];
    const merkleRootString = bytesTob64(merkleRoot);

    // Create pieces string for BitTorrent v1 (concatenated SHA-1 hashes)
    const piecesString = sha1Pieces.reduce((acc, hash) => acc + bytesTob64(hash), '');

    // Create layers for BitTorrent v2
    const layers: { [rootHash: string]: { hashes: string[] } } = {};
    const rootHashUrn = `urn:btmh:${merkleRootString}`;
    layers[rootHashUrn] = {
      hashes: sha256Pieces.map(hash => bytesTob64(hash))
    };

    // Build torrent metadata
    const torrentMetadata: TorrentMetadata = {
      announce: "udp://tracker.openbittorrent.com:80",
      "announce-list": [
        ["udp://tracker.openbittorrent.com:80"],
        ["udp://tracker.opentrackr.org:1337"],
        ["udp://9.rarbg.to:2710"],
        ["udp://tracker.kollator.com:6969"] // Future Kollator tracker
      ],
      comment: "Created by Kollator - Hybrid BitTorrent v1/v2 with Kollator chunking",
      "created by": "Kollator",
      "creation date": Date.now(),
      info: {
        name: file.name,
        "piece length": optimalPieceSize,
        pieces: piecesString,
        "meta version": 2,
        key: keyString,
        iv: ivString,
        "file tree": {
          [file.name]: {
            "": {
              length: file.size,
              "pieces root": rootHashUrn
            }
          }
        },
        layers: layers
      }
    };

    // Add signing if requested
    if (signTorrent) {
      await this.ensureEd25519Keys();
      if (this.database.ed25519PublicKey) {
        torrentMetadata.info["owner-public-key"] = this.database.ed25519PublicKey;
        torrentMetadata.info.signature = await this.signInfoDict(torrentMetadata.info);
      }
    }

    return {
      metadata: torrentMetadata,
      kollatorChunks: [] // No longer using separate Kollator chunks
    };
  }

  /**
   * Create MetaData object for database storage
   */
  createMetaData(file: File, torrentMetadata: TorrentMetadata): MetaData {
    // Use the merkle root as the hash identifier
    const rootHashUrn = Object.keys(torrentMetadata.info.layers)[0];
    const rootHash = rootHashUrn.replace('urn:btmh:', '');

    return {
      state: FileState.Cached,
      fileType: file.type.length > 0 ? file.type : file.name.slice(Math.min(file.name.lastIndexOf('.') + 1, file.name.length - 1)),
      name: file.name,
      hash: rootHash,
      size: file.size,
      key: torrentMetadata.info.key,
      iv: torrentMetadata.info.iv
    };
  }

  /**
   * Save torrent metadata to OPFS
   */
  async saveTorrentMetadata(filename: string, metadata: TorrentMetadata): Promise<void> {
    const opfsRoot = await navigator.storage.getDirectory();
    // Sanitize filename for OPFS compatibility
    const safeFilename = filename
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
      .replace(/[^a-zA-Z0-9\-_]/g, ''); // Remove any other invalid characters
    const torrentHandle = await opfsRoot.getFileHandle(`${safeFilename}torrent`, { create: true });
    const writable = await torrentHandle.createWritable();
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();
  }
}
