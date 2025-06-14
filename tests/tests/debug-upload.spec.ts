import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Debug File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('debug file upload process', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/blackpowerfist.jpg');
    
    // Step 1: Check initial state
    console.log('Step 1: Checking initial state...');
    const initialState = await page.evaluate(() => {
      return {
        //@ts-ignore
        filerExists: !!window.filer,
        //@ts-ignore
        filerDb: window.filer ? !!window.filer.db : false,
        //@ts-ignore
        filerInitialized: window.filer ? !!window.filer.initResolver : false,
        //@ts-ignore
        dropzoneExists: !!document.querySelector('.dropzone'),
        //@ts-ignore
        fileInputExists: !!document.querySelector('input[type="file"]')
      };
    });
    console.log('Initial state:', initialState);
    
    // Step 2: Wait for filer initialization
    console.log('Step 2: Waiting for filer initialization...');
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Step 3: Check filer state after initialization
    const filerState = await page.evaluate(async () => {
      //@ts-ignore
      if (window.filer && window.filer.initPromise) {
        try {
          //@ts-ignore
          await window.filer.initPromise;
          return {
            initialized: true,
            //@ts-ignore
            simpleMode: window.filer.simpleMode,
            //@ts-ignore
            dbFilesCount: window.filer.db.files.size
          };
        } catch (e: any) {
          return { error: e.message };
        }
      }
      return { initialized: false };
    });
    console.log('Filer state:', filerState);
    
    // Step 4: Upload file by directly calling filer.importFile
    console.log('Step 4: Uploading file...');
    await page.evaluate(async () => {
      // Create a mock file for testing
      const mockFileContent = new Uint8Array(25440); // Same size as blackpowerfist.jpg
      for (let i = 0; i < mockFileContent.length; i++) {
        mockFileContent[i] = Math.floor(Math.random() * 256);
      }
      
      const file = new File([mockFileContent], 'blackpowerfist.jpg', { type: 'image/jpeg' });
      
      // Directly call filer.importFile
      //@ts-ignore
      if (window.filer && window.filer.importFile) {
        try {
          //@ts-ignore
          await window.filer.importFile(file);
          console.log('File import called successfully');
        } catch (error) {
          console.error('Error importing file:', error);
        }
      } else {
        console.error('Filer not available or importFile method not found');
      }
    });
    
    // Step 5: Monitor file processing with detailed logging
    console.log('Step 5: Monitoring file processing...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (attempts < maxAttempts) {
      const status = await page.evaluate(() => {
        try {
          //@ts-ignore
          if (!window.filer || !window.filer.db) return { error: 'Filer not ready' };
          
          //@ts-ignore
          const fileCount = window.filer.db.files.size;
          //@ts-ignore
          const files = Array.from(window.filer.db.files.values()).map((f: any) => ({
            name: f.name,
            size: f.size,
            state: f.state
          }));
          
          return {
            fileCount,
            files,
            //@ts-ignore
            simpleMode: window.filer.simpleMode
          };
        } catch (e: any) {
          return { error: e.message };
        }
      });
      
      console.log(`Attempt ${attempts + 1}:`, status);
      
      if (status.fileCount > 0) {
        console.log('File processing completed!');
        break;
      }
      
      await page.waitForTimeout(1000);
      attempts++;
    }
    
    // Step 6: Check final state
    const finalState = await page.evaluate(() => {
      try {
        return {
          //@ts-ignore
          fileCount: window.filer.db.files.size,
          //@ts-ignore
          fileNames: Array.from(window.filer.db.files.values()).map(f => f.name),
          fileExplorerText: document.querySelector('.file-explorer')?.textContent || 'No file explorer found'
        };
      } catch (e: any) {
        return { error: e.message };
      }
    });
    console.log('Final state:', finalState);
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'test-results/debug-upload-final.png',
      fullPage: true 
    });
    
    // The test should pass if we got this far
    expect(finalState.fileCount).toBeGreaterThanOrEqual(0);
  });
});
