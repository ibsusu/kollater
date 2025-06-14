import { test, expect } from '@playwright/test';

test.describe('16KiB Streaming Protocol Test', () => {
  test('test complete file upload with streaming protocol', async ({ page }) => {
    console.log('=== 16KiB STREAMING PROTOCOL TEST ===');
    
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
        simpleMode: window.filer?.simpleMode
      };
    });
    
    console.log('Connection state:', connectionState);
    expect(connectionState.hubConnected).toBe(true);
    expect(connectionState.peersCount).toBe(1);
    expect(connectionState.simpleMode).toBe(false); // Should use full torrent mode
    
    // Create and upload a 2MB file to test streaming
    const uploadResult = await page.evaluate(async () => {
      try {
        const fileSize = 2 * 1024 * 1024; // 2MiB file (2,097,152 bytes)
        console.log(`Creating ${fileSize} byte file for streaming test`);
        
        const testFileData = new Uint8Array(fileSize);
        // Fill with a recognizable pattern
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = (i % 256);
        }
        
        const testFile = new File([testFileData], 'streaming-protocol-test.bin', { 
          type: 'application/octet-stream' 
        });
        
        console.log('Starting file import with streaming protocol...');
        
        // Process the file through the normal flow (should use streaming upload)
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        console.log('File import completed');
        
        // Verify the file was processed correctly
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        //@ts-ignore
        const uploadedFile = files.find((f: any) => f.name === 'streaming-protocol-test.bin');
        
        return {
          success: true,
          originalFileSize: fileSize,
          uploadedFile: uploadedFile ? {
            name: (uploadedFile as any).name,
            size: (uploadedFile as any).size,
            hash: (uploadedFile as any).hash
          } : null,
          totalFiles: files.length
        };
      } catch (error: any) {
        console.error('Upload error:', error);
        return { 
          success: false, 
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Upload result:', uploadResult);
    
    // Wait for upload to complete
    await page.waitForTimeout(15000);
    
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.uploadedFile).toBeTruthy();
    expect(uploadResult.uploadedFile?.size).toBe(2 * 1024 * 1024);
    expect(uploadResult.uploadedFile?.name).toBe('streaming-protocol-test.bin');
    
    console.log('=== 16KiB STREAMING PROTOCOL TEST COMPLETED ===');
  });

  test('test streaming protocol message handling', async ({ page }) => {
    console.log('=== STREAMING PROTOCOL MESSAGE TEST ===');
    
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
    
    // Test the streaming protocol constants are available
    const protocolTest = await page.evaluate(() => {
      try {
        return {
          success: true,
          //@ts-ignore
          hasStreamUpload: typeof window.comms.streamUpload === 'function',
          //@ts-ignore
          hasHub: !!window.comms.hub,
          //@ts-ignore
          hubConnected: window.comms.hub?.connected
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Protocol test result:', protocolTest);
    
    expect(protocolTest.success).toBe(true);
    expect(protocolTest.hasStreamUpload).toBe(true);
    expect(protocolTest.hasHub).toBe(true);
    expect(protocolTest.hubConnected).toBe(true);
    
    console.log('=== STREAMING PROTOCOL MESSAGE TEST COMPLETED ===');
  });
});
