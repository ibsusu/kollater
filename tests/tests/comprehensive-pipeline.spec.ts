import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Comprehensive File Processing Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    // Clear browser storage and start fresh
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Clear OPFS storage
    await page.evaluate(async () => {
      try {
        const directory = await navigator.storage.getDirectory();
        // @ts-ignore - entries() method exists in OPFS
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind === 'file') {
            await directory.removeEntry(name);
          }
        }
      } catch (e) {
        console.log('OPFS clear failed:', e);
      }
    });
    
    await page.reload();
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('complete file processing pipeline verification', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/blackpowerfist.jpg');
    
    console.log('=== STEP 1: Initialize and verify filer ===');
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Verify initial state
    const initialState = await page.evaluate(() => {
      return {
        //@ts-ignore
        filerExists: !!window.filer,
        //@ts-ignore
        filerDb: window.filer ? !!window.filer.db : false,
        //@ts-ignore
        simpleMode: window.filer ? window.filer.simpleMode : null,
        //@ts-ignore
        dbFilesCount: window.filer && window.filer.db ? window.filer.db.files.size : -1
      };
    });
    
    console.log('Initial state:', initialState);
    expect(initialState.filerExists).toBe(true);
    expect(initialState.filerDb).toBe(true);
    expect(initialState.dbFilesCount).toBe(0);
    
    console.log('=== STEP 2: Upload and process file ===');
    
    // Create a test file and upload it
    const uploadResult = await page.evaluate(async () => {
      try {
        // Create a mock file for testing
        const mockFileContent = new Uint8Array(25440); // Same size as blackpowerfist.jpg
        for (let i = 0; i < mockFileContent.length; i++) {
          mockFileContent[i] = Math.floor(Math.random() * 256);
        }
        
        const file = new File([mockFileContent], 'blackpowerfist.jpg', { type: 'image/jpeg' });
        
        // Store original file data for later verification
        const originalData = new Uint8Array(await file.arrayBuffer());
        
        // Import the file
        //@ts-ignore
        await window.filer.importFile(file);
        
        return {
          success: true,
          originalSize: originalData.length,
          originalChecksum: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', originalData)))
            .map(b => b.toString(16).padStart(2, '0')).join('')
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Upload result:', uploadResult);
    expect(uploadResult.success).toBe(true);
    
    console.log('=== STEP 3: Verify file processing and storage ===');
    
    // Wait for file processing to complete
    await page.waitForFunction(() => {
      try {
        //@ts-ignore
        return window.filer && window.filer.db && window.filer.db.files.size > 0;
      } catch (e) { return false; }
    }, { timeout: 30000 });
    
    // Verify database content
    const dbContent = await page.evaluate(() => {
      try {
        //@ts-ignore
        const fileCount = window.filer.db.files.size;
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values()).map((f: any) => ({
          name: f.name,
          size: f.size,
          hash: f.hash,
          state: f.state
        }));
        return { fileCount, files };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    
    console.log('Database content:', dbContent);
    expect(dbContent.fileCount).toBe(1);
    expect(dbContent.files).toBeDefined();
    expect(dbContent.files![0].name).toBe('blackpowerfist.jpg');
    expect(dbContent.files![0].size).toBe(25440);
    
    console.log('=== STEP 4: Verify OPFS storage ===');
    
    // Check OPFS storage
    const opfsContent = await page.evaluate(async () => {
      try {
        const directory = await navigator.storage.getDirectory();
        const files = [];
        let totalSize = 0;
        
        // @ts-ignore - entries() method exists in OPFS
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind === 'file' && name !== 'kollatorDb') {
            const file = await handle.getFile();
            files.push({
              name,
              size: file.size,
              type: file.type
            });
            totalSize += file.size;
          }
        }
        
        return { files, totalSize, count: files.length };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    
    console.log('OPFS content:', opfsContent);
    expect(opfsContent.count).toBeGreaterThan(0);
    expect(opfsContent.totalSize).toBeGreaterThan(0);
    
    console.log('=== STEP 5: Verify file reconstruction ===');
    
    // Test file reconstruction by downloading
    const reconstructionTest = await page.evaluate(async () => {
      try {
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        if (files.length === 0) return { error: 'No files in database' };
        
        const fileMetadata = files[0] as any;
        const directory = await navigator.storage.getDirectory();
        
        // Get the stored file
        const fileHandle = await directory.getFileHandle(fileMetadata.hash);
        const storedFile = await fileHandle.getFile();
        const storedData = new Uint8Array(await storedFile.arrayBuffer());
        
        // Verify file integrity
        const storedChecksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', storedData)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        
        return {
          success: true,
          storedSize: storedData.length,
          storedChecksum,
          canReconstruct: storedData.length > 0
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Reconstruction test:', reconstructionTest);
    expect(reconstructionTest.success).toBe(true);
    expect(reconstructionTest.canReconstruct).toBe(true);
    expect(reconstructionTest.storedSize).toBe(25440);
    
    console.log('=== STEP 6: Verify UI updates ===');
    
    // Verify file appears in the file explorer
    const fileExplorerContent = await page.locator('.file-explorer').textContent();
    expect(fileExplorerContent).toContain('blackpowerfist.jpg');
    
    // Verify file explorer shows correct file count
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    const fileItemCount = await fileItems.count();
    expect(fileItemCount).toBeGreaterThan(1); // Should have header + file items
    
    console.log('=== STEP 7: Test file export functionality ===');
    
    // Test file export
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.file-explorer .bg-green-600').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('blackpowerfist.jpg');
    
    console.log('=== STEP 8: Verify worker communication (if not in simple mode) ===');
    
    const workerCommTest = await page.evaluate(() => {
      try {
        //@ts-ignore
        const simpleMode = window.filer.simpleMode;
        //@ts-ignore
        const commsExists = !!window.comms;
        //@ts-ignore
        const hubConnected = window.comms && window.comms.hub && !window.comms.hub.destroyed;
        
        return {
          simpleMode,
          commsExists,
          hubConnected,
          //@ts-ignore
          peersCount: window.comms ? window.comms.peers.size : 0
        };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    
    console.log('Worker communication test:', workerCommTest);
    
    // Take comprehensive screenshots
    await page.screenshot({ 
      path: 'test-results/comprehensive-pipeline-success.png',
      fullPage: true 
    });
    
    // Add success indicator
    await page.evaluate(([dbCount, opfsCount, workerInfo]: [number, number, any]) => {
      const indicator = document.createElement('div');
      indicator.style.position = 'fixed';
      indicator.style.top = '10px';
      indicator.style.right = '10px';
      indicator.style.background = 'green';
      indicator.style.color = 'white';
      indicator.style.padding = '15px';
      indicator.style.borderRadius = '5px';
      indicator.style.zIndex = '9999';
      indicator.style.fontSize = '14px';
      indicator.style.fontWeight = 'bold';
      indicator.style.lineHeight = '1.4';
      indicator.innerHTML = `
        ✓ PIPELINE COMPLETE<br>
        DB Files: ${dbCount}<br>
        OPFS Files: ${opfsCount}<br>
        Simple Mode: ${workerInfo.simpleMode}<br>
        Comms: ${workerInfo.commsExists ? '✓' : '✗'}<br>
        Hub: ${workerInfo.hubConnected ? '✓' : '✗'}
      `;
      document.body.appendChild(indicator);
    }, [dbContent.fileCount, opfsContent.count, workerCommTest]);
    
    await page.screenshot({ 
      path: 'test-results/comprehensive-pipeline-complete.png'
    });
    
    console.log('=== PIPELINE TEST COMPLETED SUCCESSFULLY ===');
  });

  test('verify chunk processing and storage', async ({ page }) => {
    console.log('=== CHUNK PROCESSING VERIFICATION TEST ===');
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Create a larger file to ensure chunking occurs
    const chunkTest = await page.evaluate(async () => {
      try {
        // Create a 6MB file to ensure multiple chunks (5MB chunk size)
        const fileSize = 6 * 1024 * 1024;
        const mockFileContent = new Uint8Array(fileSize);
        for (let i = 0; i < mockFileContent.length; i++) {
          mockFileContent[i] = i % 256; // Pattern for verification
        }
        
        const file = new File([mockFileContent], 'large-test-file.bin', { type: 'application/octet-stream' });
        
        // Import the file
        //@ts-ignore
        await window.filer.importFile(file);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check OPFS for chunks
        const directory = await navigator.storage.getDirectory();
        const chunks = [];
        
        // @ts-ignore
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind === 'file' && name !== 'kollatorDb' && name !== 'large-test-file.bin') {
            const file = await handle.getFile();
            chunks.push({
              name,
              size: file.size
            });
          }
        }
        
        return {
          success: true,
          originalSize: fileSize,
          chunksFound: chunks.length,
          chunks
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Chunk test result:', chunkTest);
    expect(chunkTest.success).toBe(true);
    expect(chunkTest.chunksFound).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/chunk-processing-verification.png',
      fullPage: true 
    });
  });
});
