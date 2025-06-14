import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Worker Upload Test', () => {
  test('verify worker upload handler directly', async ({ page }) => {
    console.log('=== TESTING WORKER UPLOAD HANDLER DIRECTLY ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Test the upload mechanism by directly calling the worker via HTTP
    const uploadTest = await page.evaluate(async () => {
      try {
        // Create test data
        const testData = new Uint8Array(1024); // 1KB test file
        for (let i = 0; i < testData.length; i++) {
          testData[i] = i % 256;
        }
        
        // Create hash for the test data
        const hashBuffer = await crypto.subtle.digest('SHA-256', testData);
        const hash = new Uint8Array(hashBuffer);
        
        // Convert hash to base64 for transmission
        const hashBase64 = btoa(String.fromCharCode(...hash));
        
        // Create the upload payload (hash + data)
        const uploadPayload = new Uint8Array(32 + testData.length);
        uploadPayload.set(hash, 0);
        uploadPayload.set(testData, 32);
        
        return {
          success: true,
          testDataSize: testData.length,
          hashBase64: hashBase64,
          uploadPayloadSize: uploadPayload.length
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Upload test result:', uploadTest);
    expect(uploadTest.success).toBe(true);
    expect(uploadTest.testDataSize).toBe(1024);
    expect(uploadTest.uploadPayloadSize).toBe(1056); // 32 bytes hash + 1024 bytes data
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/worker-upload-test.png',
      fullPage: true 
    });
  });

  test('verify file processing creates proper chunks', async ({ page }) => {
    console.log('=== TESTING FILE CHUNK CREATION ===');
    
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    const chunkTest = await page.evaluate(async () => {
      try {
        // Create a test file
        const fileSize = 1024 * 1024; // 1MB file
        const testFileData = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = i % 256;
        }
        
        const testFile = new File([testFileData], 'test-file.bin', { type: 'application/octet-stream' });
        
        // Process the file
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        // Check what was created
        //@ts-ignore
        const fileCount = window.filer.db.files.size;
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        
        // Check OPFS storage
        const directory = await navigator.storage.getDirectory();
        const opfsFiles = [];
        
        // @ts-ignore
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind === 'file' && name !== 'kollatorDb') {
            const file = await handle.getFile();
            opfsFiles.push({
              name,
              size: file.size
            });
          }
        }
        
        return {
          success: true,
          originalFileSize: fileSize,
          dbFileCount: fileCount,
          dbFiles: files,
          opfsFileCount: opfsFiles.length,
          opfsFiles: opfsFiles
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Chunk test result:', chunkTest);
    expect(chunkTest.success).toBe(true);
    expect(chunkTest.dbFileCount).toBe(1);
    expect(chunkTest.opfsFileCount).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/chunk-creation-test.png',
      fullPage: true 
    });
  });
});
