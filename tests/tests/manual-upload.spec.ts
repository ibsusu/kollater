import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Manual File Upload Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should upload blackpowerfist.jpg using setInputFiles and verify file explorer updates', async ({ page }) => {
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
    
    // Check initial file count
    const initialFileCount = await page.evaluate(() => {
      //@ts-ignore
      return window.filer.db.files.size;
    });
    console.log('Initial file count:', initialFileCount);
    
    // Upload file using setInputFiles (this should trigger Dropzone's addedfile event)
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait for file processing to complete
    await page.waitForFunction(() => {
      try {
        //@ts-ignore
        if (window.filer && window.filer.db && window.filer.db.files) {
          //@ts-ignore
          return window.filer.db.files.size > 0;
        }
        return false;
      } catch (e) { return false; }
    }, { timeout: 15000 });
    
    // Check final file count
    const finalFileCount = await page.evaluate(() => {
      //@ts-ignore
      return window.filer.db.files.size;
    });
    console.log('Final file count:', finalFileCount);
    
    // Verify database content
    const dbContent = await page.evaluate(async () => {
      try {
        //@ts-ignore
        if (window.filer && window.filer.db) {
          //@ts-ignore
          const fileCount = window.filer.db.files.size;
          //@ts-ignore
          const fileNames = Array.from(window.filer.db.files.values()).map(f => f.name);
          return { fileCount, fileNames };
        }
        return { fileCount: 0, fileNames: [] };
      } catch (e) { return { fileCount: -1, fileNames: [] }; }
    });
    
    console.log('Database content:', dbContent);
    
    // Wait for UI to update
    await page.waitForTimeout(3000);
    
    // Check if file explorer shows the file
    const fileExplorerText = await page.locator('.file-explorer').textContent();
    console.log('File explorer content:', fileExplorerText);
    
    // Take a screenshot to see the current state
    await page.screenshot({ 
      path: 'test-results/manual-upload-test.png',
      fullPage: true 
    });
    
    // Verify the file was processed
    expect(dbContent.fileCount).toBeGreaterThan(0);
    expect(dbContent.fileNames).toContain('blackpowerfist.jpg');
    
    // Verify the file appears in the file explorer
    expect(fileExplorerText).toContain('blackpowerfist.jpg');
  });

  test('should test dropzone event handling directly', async ({ page }) => {
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
    
    // Test if Dropzone is properly initialized
    const dropzoneInfo = await page.evaluate(() => {
      const dropzoneElement = document.querySelector('.dropzone');
      return {
        exists: !!dropzoneElement,
        //@ts-ignore
        hasDropzoneInstance: !!(dropzoneElement && dropzoneElement.dropzone),
        //@ts-ignore
        dropzoneOptions: dropzoneElement && dropzoneElement.dropzone ? {
          //@ts-ignore
          url: dropzoneElement.dropzone.options.url,
          //@ts-ignore
          maxFilesize: dropzoneElement.dropzone.options.maxFilesize,
          //@ts-ignore
          autoProcessQueue: dropzoneElement.dropzone.options.autoProcessQueue
        } : null
      };
    });
    
    console.log('Dropzone info:', dropzoneInfo);
    
    // Verify Dropzone is properly set up
    expect(dropzoneInfo.exists).toBe(true);
    expect(dropzoneInfo.hasDropzoneInstance).toBe(true);
    expect(dropzoneInfo.dropzoneOptions?.url).toBe('/file/post');
    expect(dropzoneInfo.dropzoneOptions?.autoProcessQueue).toBe(false);
    
    // Test manual file addition to Dropzone
    const testResult = await page.evaluate(async () => {
      try {
        // Create a mock file
        const mockFileContent = new Uint8Array(25440);
        for (let i = 0; i < mockFileContent.length; i++) {
          mockFileContent[i] = Math.floor(Math.random() * 256);
        }
        
        const file = new File([mockFileContent], 'blackpowerfist.jpg', { type: 'image/jpeg' });
        
        // Get the Dropzone instance
        const dropzoneElement = document.querySelector('.dropzone');
        //@ts-ignore
        if (dropzoneElement && dropzoneElement.dropzone) {
          //@ts-ignore
          const dz = dropzoneElement.dropzone;
          
          // Manually trigger the addedfile event
          dz.emit('addedfile', file);
          
          return { success: true, fileName: file.name };
        }
        
        return { success: false, error: 'Dropzone not found' };
      } catch (error) {
        //@ts-ignore
        return { success: false, error: error.message };
      }
    });
    
    console.log('Manual file addition result:', testResult);
    
    // Wait for file processing
    await page.waitForTimeout(3000);
    
    // Check if file was processed
    const finalDbContent = await page.evaluate(() => {
      //@ts-ignore
      return window.filer.db.files.size;
    });
    
    console.log('Final database file count:', finalDbContent);
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/dropzone-manual-test.png',
      fullPage: true 
    });
    
    expect(testResult.success).toBe(true);
    expect(finalDbContent).toBeGreaterThan(0);
  });
});
