import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('File Upload Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    // Wait for Dropzone to initialize
    await page.waitForTimeout(2000);
    
    // Clear any existing files from storage by refreshing the page
    await page.reload();
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  test('should load the application successfully', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('KOLLATOR');
    await expect(page.locator('.dropzone')).toBeVisible();
    await expect(page.locator('.file-explorer')).toBeVisible();
  });

  test('should upload a small image file', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/blackpowerfist.jpg');
    
    // Wait for Dropzone to be fully initialized and find the file input
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    // Get the file input created by Dropzone
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait for file to be processed and appear in the file explorer
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 15000 });
    
    // Verify file appears in the file explorer (check that at least 1 file exists)
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    await expect(fileItems.first()).toContainText('blackpowerfist.jpg');
  });

  test('should upload multiple image files', async ({ page }) => {
    const testFiles = [
      path.join(__dirname, '../../test_files/blackpowerfist.jpg'),
      path.join(__dirname, '../../test_files/ippo_timeline.png'),
      path.join(__dirname, '../../test_files/landscapers_large.jpg')
    ];
    
    // Wait for Dropzone to be ready
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    // Upload files one by one
    const fileInput = page.locator('input[type="file"]').first();
    for (const testFile of testFiles) {
      await fileInput.setInputFiles(testFile);
      await page.waitForTimeout(3000); // Give time for processing
    }
    
    // Wait for all files to be processed
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 20000 });
    
    // Verify files appear in the file explorer (check that files exist)
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    const count = await fileItems.count();
    expect(count).toBeGreaterThan(2);
  });

  test('should handle large file upload', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/Solo.Leveling.S01E11.A.Knight.Who.Defends.an.Empty.Throne.1080p.CR.WEB-DL.AAC2.0.H.264-VARYG.mkv');
    
    // Wait for Dropzone to be ready
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    // Upload large file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait longer for large file processing
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 60000 });
    
    // Verify file appears in the file explorer
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    await expect(fileItems.first()).toContainText('Solo.Leveling');
  });

  test('should allow file download/export', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/ippo_instep.png');
    
    // Wait for Dropzone to be ready
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    // Upload file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait for file to be processed
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 15000 });
    
    // Set up download promise before clicking download button
    const downloadPromise = page.waitForEvent('download');
    
    // Click the download button in the file explorer
    await page.locator('.file-explorer .bg-green-600').first().click();
    
    // Wait for download to complete
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('ippo_instep.png');
  });

  test('should display file explorer view', async ({ page }) => {
    // Upload a few files first
    const testFiles = [
      path.join(__dirname, '../../test_files/blackpowerfist.jpg'),
      path.join(__dirname, '../../test_files/ippo_timeline.png')
    ];
    
    // Wait for Dropzone to be ready
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    const fileInput = page.locator('input[type="file"]').first();
    for (const testFile of testFiles) {
      await fileInput.setInputFiles(testFile);
      await page.waitForTimeout(3000);
    }
    
    // Wait for files to be processed
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 20000 });
    
    // Verify file explorer shows files
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    const count = await fileItems.count();
    expect(count).toBeGreaterThan(1);
    
    // Check that file explorer components are visible
    await expect(page.locator('.file-explorer h2')).toContainText('OPFS File Explorer');
    await expect(page.locator('.file-explorer .bg-gray-800').first()).toBeVisible();
  });

  test('should handle torrent files', async ({ page }) => {
    const testFile = path.join(__dirname, '../../test_files/[ASW] Hazurewaku - 11 [1080p HEVC][D46C1C61].mkv.torrent');
    
    // Wait for Dropzone to be ready
    await page.waitForFunction(() => {
      const inputs = document.querySelectorAll('input[type="file"]');
      return inputs.length > 0;
    }, { timeout: 10000 });
    
    // Upload torrent file
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFile);
    
    // Wait for file to be processed
    await page.waitForSelector('.file-explorer .bg-gray-800', { timeout: 15000 });
    
    // Verify torrent file appears in the file explorer
    const fileItems = page.locator('.file-explorer .bg-gray-800');
    await expect(fileItems.first()).toContainText('Hazurewaku');
  });
});
