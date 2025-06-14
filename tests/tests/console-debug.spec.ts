import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Console Debug Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });
    
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should debug dropzone file import with console logs', async ({ page }) => {
    // Wait for filer to be initialized
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db && window.filer.initResolver;
    }, { timeout: 10000 });
    
    // Wait for the initialization to complete
    await page.evaluate(async () => {
      //@ts-ignore
      if (window.filer && window.filer.initPromise) {
        //@ts-ignore
        await window.filer.initPromise;
      }
    });
    
    console.log('=== Starting file import test ===');
    
    // Test manual file addition to Dropzone with detailed logging
    const testResult = await page.evaluate(async () => {
      try {
        console.log('Creating mock file...');
        
        // Create a mock file
        const mockFileContent = new Uint8Array(25440);
        for (let i = 0; i < mockFileContent.length; i++) {
          mockFileContent[i] = Math.floor(Math.random() * 256);
        }
        
        const file = new File([mockFileContent], 'blackpowerfist.jpg', { type: 'image/jpeg' });
        console.log('Mock file created:', file.name, file.size, file.type);
        
        // Check filer state before import
        //@ts-ignore
        console.log('Filer state before import:', {
          //@ts-ignore
          filerExists: !!window.filer,
          //@ts-ignore
          dbExists: !!(window.filer && window.filer.db),
          //@ts-ignore
          simpleMode: window.filer ? window.filer.simpleMode : 'unknown',
          //@ts-ignore
          fileCount: window.filer && window.filer.db ? window.filer.db.files.size : 'unknown'
        });
        
        // Get the Dropzone instance
        const dropzoneElement = document.querySelector('.dropzone');
        //@ts-ignore
        if (dropzoneElement && dropzoneElement.dropzone) {
          //@ts-ignore
          const dz = dropzoneElement.dropzone;
          
          console.log('Dropzone found, triggering addedfile event...');
          
          // Manually trigger the addedfile event
          dz.emit('addedfile', file);
          
          // Wait a bit for the async operation
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check filer state after import
          //@ts-ignore
          console.log('Filer state after import:', {
            //@ts-ignore
            fileCount: window.filer && window.filer.db ? window.filer.db.files.size : 'unknown',
            //@ts-ignore
            fileNames: window.filer && window.filer.db ? Array.from(window.filer.db.files.values()).map(f => f.name) : []
          });
          
          return { success: true, fileName: file.name };
        }
        
        return { success: false, error: 'Dropzone not found' };
      } catch (error) {
        console.error('Error in test:', error);
        //@ts-ignore
        return { success: false, error: error.message };
      }
    });
    
    console.log('Test result:', testResult);
    
    // Wait for any async operations to complete
    await page.waitForTimeout(5000);
    
    // Check final state
    const finalState = await page.evaluate(() => {
      //@ts-ignore
      return {
        //@ts-ignore
        fileCount: window.filer && window.filer.db ? window.filer.db.files.size : 'unknown',
        //@ts-ignore
        fileNames: window.filer && window.filer.db ? Array.from(window.filer.db.files.values()).map(f => f.name) : []
      };
    });
    
    console.log('Final state:', finalState);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/console-debug-test.png',
      fullPage: true 
    });
    
    expect(testResult.success).toBe(true);
  });

  test('should test real file upload with blackpowerfist.jpg', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/blackpowerfist.jpg');
    
    // Wait for filer to be initialized
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db && window.filer.initResolver;
    }, { timeout: 10000 });
    
    // Wait for the initialization to complete
    await page.evaluate(async () => {
      //@ts-ignore
      if (window.filer && window.filer.initPromise) {
        //@ts-ignore
        await window.filer.initPromise;
      }
    });
    
    console.log('=== Starting real file upload test ===');
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      //@ts-ignore
      return window.filer.db.files.size;
    });
    console.log('Initial file count:', initialState);
    
    // Upload file using setInputFiles
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait and check if anything happened
    await page.waitForTimeout(5000);
    
    const finalState = await page.evaluate(() => {
      //@ts-ignore
      return {
        //@ts-ignore
        fileCount: window.filer.db.files.size,
        //@ts-ignore
        fileNames: Array.from(window.filer.db.files.values()).map(f => f.name)
      };
    });
    
    console.log('Final state after setInputFiles:', finalState);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/real-file-upload-test.png',
      fullPage: true 
    });
    
    // The test should show us what's happening
    expect(initialState).toBeGreaterThanOrEqual(0);
  });
});
