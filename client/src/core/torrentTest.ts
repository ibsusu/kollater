import { TorrentFileProcessor } from './torrentFileProcessor';
import { Database, FileState } from './fileTypes';

/**
 * Test function to demonstrate the dual-chunking torrent system
 */
export async function testTorrentFileProcessor() {
  // Create a mock database for testing
  const mockDatabase: Database = {
    handle: {} as FileSystemFileHandle,
    files: new Map(),
    name: "Test User",
    email: "test@kollator.com",
    password: "test",
    provider: "kollator"
    // Ed25519 keys will be generated automatically
  };

  // Create the processor
  const processor = new TorrentFileProcessor(mockDatabase);

  // Create a test file (you would normally get this from a file input)
  const testContent = "This is a test file for the dual-chunking torrent system. ".repeat(100000);
  const testFile = new File([testContent], "test-file.txt", { type: "text/plain" });

  console.log("Processing file:", testFile.name, "Size:", testFile.size, "bytes");

  try {
    // Process the file with signing enabled
    const result = await processor.processFile(testFile, true);
    
    console.log("✅ Torrent processing completed!");
    console.log("📊 Torrent Metadata:");
    console.log("  - BitTorrent piece size:", result.metadata.info["piece length"], "bytes");
    console.log("  - BitTorrent pieces count:", result.metadata.info.pieces.length / 28, "(SHA-1 hashes)"); // Each SHA-1 hash is 28 chars in base64
    console.log("  - BitTorrent v2 layers:", Object.keys(result.metadata.info.layers).length);
    console.log("  - Kollator chunk size:", result.metadata.info["kollator-chunk-size"], "bytes");
    console.log("  - Kollator chunks count:", result.metadata.info["kollator-chunk-hashes"].length);
    console.log("  - Signed:", !!result.metadata.info.signature);
    console.log("  - Owner public key:", result.metadata.info["owner-public-key"] ? "Present" : "None");

    // Create metadata for database storage
    const metaData = processor.createMetaData(testFile, result.metadata);
    console.log("📁 Database MetaData:");
    console.log("  - Hash:", metaData.hash);
    console.log("  - State:", FileState[metaData.state]);
    console.log("  - File type:", metaData.fileType);

    // Save torrent metadata
    await processor.saveTorrentMetadata(testFile.name, result.metadata);
    console.log("💾 Torrent metadata saved to OPFS");

    console.log("🎯 Kollator chunk hashes:", result.kollatorChunks.slice(0, 3), "...");

    return {
      success: true,
      metadata: result.metadata,
      kollatorChunks: result.kollatorChunks,
      metaData
    };

  } catch (error) {
    console.error("❌ Error processing torrent:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test function to verify torrent compatibility
 */
export function validateTorrentStructure(metadata: any) {
  console.log("🔍 Validating torrent structure...");
  
  const checks = [
    { name: "Has announce URL", test: () => typeof metadata.announce === 'string' },
    { name: "Has announce-list", test: () => Array.isArray(metadata["announce-list"]) },
    { name: "Has info dict", test: () => typeof metadata.info === 'object' },
    { name: "Has piece length", test: () => typeof metadata.info["piece length"] === 'number' },
    { name: "Has pieces (v1)", test: () => typeof metadata.info.pieces === 'string' },
    { name: "Has file tree (v2)", test: () => typeof metadata.info["file tree"] === 'object' },
    { name: "Has layers (v2)", test: () => typeof metadata.info.layers === 'object' },
    { name: "Has meta version", test: () => metadata.info["meta version"] === 2 },
    { name: "Has Kollator chunk size", test: () => metadata.info["kollator-chunk-size"] === 5242880 },
    { name: "Has Kollator chunk hashes", test: () => Array.isArray(metadata.info["kollator-chunk-hashes"]) },
    { name: "Has encryption key", test: () => typeof metadata.info.key === 'string' },
    { name: "Has encryption IV", test: () => typeof metadata.info.iv === 'string' }
  ];

  let passed = 0;
  checks.forEach(check => {
    try {
      if (check.test()) {
        console.log(`  ✅ ${check.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${check.name}`);
      }
    } catch (e) {
      console.log(`  ❌ ${check.name} (error: ${e instanceof Error ? e.message : String(e)})`);
    }
  });

  console.log(`📋 Validation complete: ${passed}/${checks.length} checks passed`);
  return passed === checks.length;
}
