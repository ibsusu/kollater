import { test, expect } from '@playwright/test';

test.describe('WebRTC Small File Upload Test', () => {
  test('upload small file via WebRTC and verify in worker storage', async ({ page }) => {
    console.log('=== WEBRTC SMALL FILE UPLOAD TEST ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      return {
        //@ts-ignore
        simpleMode: window.filer?.simpleMode,
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0
      };
    });
    
    console.log('Initial state:', initialState);
    expect(initialState.simpleMode).toBe(false); // Should be in full WebRTC mode
    expect(initialState.hubConnected).toBe(true);
    expect(initialState.peersCount).toBe(1);
    
    // Create and upload a small test file (10KB)
    const uploadResult = await page.evaluate(async () => {
      try {
        // Create a small test file (10KB)
        const fileSize = 10 * 1024; // 10KB file
        const testFileData = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = i % 256;
        }
        
        const testFile = new File([testFileData], 'small-test.bin', { type: 'application/octet-stream' });
        
        console.log('Starting file import...');
        
        // Process the file (this should trigger WebRTC upload)
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        console.log('File import completed');
        
        // Check the results
        //@ts-ignore
        const fileCount = window.filer.db.files.size;
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        
        return {
          success: true,
          originalFileSize: fileSize,
          dbFileCount: fileCount,
          dbFiles: files.map((f: any) => ({ name: f.name, size: f.size, hash: f.hash }))
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
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/webrtc-small-upload-test.png',
      fullPage: true 
    });
    
    // Verify upload was successful
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.dbFileCount).toBe(1);
    if (uploadResult.success && uploadResult.dbFiles) {
      expect(uploadResult.dbFiles[0].name).toBe('small-test.bin');
      expect(uploadResult.dbFiles[0].size).toBe(10240);
    }
    
    console.log('=== WEBRTC SMALL FILE UPLOAD TEST COMPLETED SUCCESSFULLY ===');
  });
});
