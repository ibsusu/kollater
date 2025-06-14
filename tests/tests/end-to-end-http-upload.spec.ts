import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('End-to-End Upload Test', () => {
  test('upload file to worker and verify storage', async ({ page }) => {
    console.log('=== END-TO-END UPLOAD TEST ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Step 1: Create and process a file on the client
    const clientProcessing = await page.evaluate(async () => {
      try {
        // Create a test file
        const fileSize = 1024; // 1KB file for testing
        const testFileData = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = i % 256;
        }
        
        const testFile = new File([testFileData], 'test-upload.bin', { type: 'application/octet-stream' });
        
        // Process the file (this will store it in OPFS)
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        // Get the file metadata
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        const fileMetadata = files[0] as any;
        
        // Get the file from OPFS
        const directory = await navigator.storage.getDirectory();
        const fileHandle = await directory.getFileHandle(fileMetadata.hash);
        const storedFile = await fileHandle.getFile();
        const storedData = new Uint8Array(await storedFile.arrayBuffer());
        
        // Create hash for the file
        const hashBuffer = await crypto.subtle.digest('SHA-256', storedData);
        const hash = new Uint8Array(hashBuffer);
        
        // Create upload payload (hash + data)
        const uploadPayload = new Uint8Array(32 + storedData.length);
        uploadPayload.set(hash, 0);
        uploadPayload.set(storedData, 32);
        
        return {
          success: true,
          fileMetadata: fileMetadata,
          originalSize: fileSize,
          storedSize: storedData.length,
          uploadPayloadSize: uploadPayload.length,
          uploadPayload: Array.from(uploadPayload) // Convert to array for transfer
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Client processing result:', {
      success: clientProcessing.success,
      fileMetadata: clientProcessing.fileMetadata,
      originalSize: clientProcessing.originalSize,
      storedSize: clientProcessing.storedSize,
      uploadPayloadSize: clientProcessing.uploadPayloadSize
    });
    
    expect(clientProcessing.success).toBe(true);
    expect(clientProcessing.storedSize).toBe(1024);
    expect(clientProcessing.uploadPayloadSize).toBe(1056); // 32 bytes hash + 1024 bytes data
    
    // Step 2: Upload to worker via HTTP
    const uploadResult = await page.evaluate(async (uploadPayload) => {
      try {
        const response = await fetch('http://localhost:3001/upload', {
          method: 'POST',
          body: new Uint8Array(uploadPayload),
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        });
        
        const responseText = await response.text();
        
        return {
          success: response.ok,
          status: response.status,
          responseText: responseText
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }, clientProcessing.uploadPayload);
    
    console.log('Upload result:', uploadResult);
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.status).toBe(200);
    expect(uploadResult.responseText).toBe('Upload successful');
    
    // Step 3: Wait a moment for the worker to process the upload
    await page.waitForTimeout(2000);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/end-to-end-upload-success.png',
      fullPage: true 
    });
    
    console.log('=== END-TO-END UPLOAD TEST COMPLETED SUCCESSFULLY ===');
  });

  test('verify worker status endpoint', async ({ page }) => {
    console.log('=== TESTING WORKER STATUS ENDPOINT ===');
    
    await page.goto('/');
    
    const statusTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:3001/status');
        const responseText = await response.text();
        
        return {
          success: response.ok,
          status: response.status,
          responseText: responseText
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Status test result:', statusTest);
    expect(statusTest.success).toBe(true);
    expect(statusTest.status).toBe(200);
    expect(statusTest.responseText).toBe('Worker is running');
  });
});
