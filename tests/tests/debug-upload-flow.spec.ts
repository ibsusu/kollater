import { test, expect } from '@playwright/test';

test.describe('Debug Upload Flow Test', () => {
  test('debug upload flow with detailed logging', async ({ page }) => {
    console.log('=== DEBUG UPLOAD FLOW TEST ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Check connection state
    const connectionState = await page.evaluate(() => {
      return {
        //@ts-ignore
        simpleMode: window.filer?.simpleMode,
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0
      };
    });
    
    console.log('Connection state:', connectionState);
    expect(connectionState.hubConnected).toBe(true);
    expect(connectionState.peersCount).toBe(1);
    
    // Add debugging to the upload method
    await page.evaluate(() => {
      //@ts-ignore
      const originalUpload = window.comms.upload;
      //@ts-ignore
      window.comms.upload = function(hash, data) {
        console.log('=== UPLOAD CALLED ===');
        console.log('Hash:', hash);
        console.log('Data size:', data.length);
        console.log('Hub connected:', this.hub?.connected);
        console.log('Peers count:', this.peers.size);
        return originalUpload.call(this, hash, data);
      };
    });
    
    // Create and upload a small file
    const uploadResult = await page.evaluate(async () => {
      try {
        const fileSize = 1024 * 1024; // 1MB file
        console.log(`Creating ${fileSize} byte file`);
        
        const testFileData = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = (i % 256);
        }
        
        const testFile = new File([testFileData], 'debug-test.bin', { type: 'application/octet-stream' });
        
        console.log('Starting file import...');
        
        // Process the file
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        console.log('File import completed');
        
        return {
          success: true,
          originalFileSize: fileSize
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
    await page.waitForTimeout(5000);
    
    expect(uploadResult.success).toBe(true);
    
    console.log('=== DEBUG UPLOAD FLOW TEST COMPLETED ===');
  });
});
