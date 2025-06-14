import { test, expect } from '@playwright/test';

test.describe('Debug Streaming Upload', () => {
  test('debug streaming upload flow with detailed logging', async ({ page }) => {
    console.log('=== DEBUG STREAMING UPLOAD TEST ===');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
      }
    });
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db && window.comms;
    }, { timeout: 15000 });
    
    // Wait for WebRTC connection
    await page.waitForTimeout(10000);
    
    // Check connection state
    const connectionState = await page.evaluate(() => {
      return {
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0,
        //@ts-ignore
        simpleMode: window.filer?.simpleMode,
        //@ts-ignore
        hubExists: !!window.comms?.hub,
        //@ts-ignore
        hubDestroyed: window.comms?.hub?.destroyed
      };
    });
    
    console.log('Connection state:', connectionState);
    expect(connectionState.hubConnected).toBe(true);
    
    // Create a 2MiB file and test streaming upload directly
    const streamingResult = await page.evaluate(async () => {
      try {
        console.log("=== STARTING DIRECT STREAMING TEST ===");
        
        const fileSize = 2 * 1024 * 1024; // 2MiB
        const testFileData = new Uint8Array(fileSize);
        
        // Fill with pattern
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = (i % 256);
        }
        
        const testFile = new File([testFileData], 'debug-streaming-test.bin', { 
          type: 'application/octet-stream' 
        });
        
        console.log("Created test file:", testFile.size, "bytes");
        
        // Create mock torrent metadata
        const mockMetadata: any = {
          info: {
            name: 'debug-streaming-test.bin',
            length: fileSize,
            'piece length': 32768, // 32KB pieces
            layers: {
              'test': {
                hashes: []
              }
            }
          }
        };
        
        // Calculate number of pieces
        const pieceCount = Math.ceil(fileSize / 32768);
        const hashes: string[] = [];
        for (let i = 0; i < pieceCount; i++) {
          hashes.push(`piece_${i}_hash`);
        }
        mockMetadata.info.layers.test.hashes = hashes;
        
        console.log("Mock metadata created:", {
          pieceCount,
          pieceLength: mockMetadata.info['piece length'],
          totalSize: mockMetadata.info.length
        });
        
        // Create torrent hash
        const metadataBytes = new TextEncoder().encode(JSON.stringify(mockMetadata));
        const torrentHash = new Uint8Array(await crypto.subtle.digest('SHA-256', metadataBytes));
        
        console.log("Torrent hash created:", Array.from(torrentHash).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        // Test streaming upload directly
        //@ts-ignore
        console.log("Calling streamUpload...");
        //@ts-ignore
        await window.comms.streamUpload(torrentHash, mockMetadata, testFile);
        console.log("streamUpload completed successfully");
        
        return {
          success: true,
          fileSize,
          pieceCount,
          torrentHashHex: Array.from(torrentHash).map(b => b.toString(16).padStart(2, '0')).join('')
        };
        
      } catch (error: any) {
        console.error("Streaming upload error:", error);
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Streaming result:', streamingResult);
    
    // Wait for any async operations to complete
    await page.waitForTimeout(10000);
    
    expect(streamingResult.success).toBe(true);
    expect(streamingResult.fileSize).toBe(2 * 1024 * 1024);
    
    console.log('=== DEBUG STREAMING UPLOAD TEST COMPLETED ===');
  });
});
