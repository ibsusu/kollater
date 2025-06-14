import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('WebRTC Upload Test', () => {
  test('establish WebRTC connection and upload file', async ({ page }) => {
    console.log('=== WEBRTC CONNECTION AND UPLOAD TEST ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(3000); // Give more time for initialization
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Check initial connection state
    const initialState = await page.evaluate(() => {
      return {
        //@ts-ignore
        filerExists: !!window.filer,
        //@ts-ignore
        filerDb: !!window.filer?.db,
        //@ts-ignore
        simpleMode: window.filer?.simpleMode,
        //@ts-ignore
        commsExists: !!window.comms,
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0
      };
    });
    
    console.log('Initial connection state:', initialState);
    expect(initialState.filerExists).toBe(true);
    expect(initialState.filerDb).toBe(true);
    expect(initialState.simpleMode).toBe(false); // Should be in full WebRTC mode
    expect(initialState.commsExists).toBe(true);
    
    // Wait for WebRTC connection to establish
    console.log('Waiting for WebRTC connection...');
    await page.waitForTimeout(5000); // Give time for connection
    
    const connectionState = await page.evaluate(() => {
      return {
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0,
        //@ts-ignore
        hubReadyState: window.comms?.hub?.readyState,
        //@ts-ignore
        hubUrl: window.comms?.hub?.url
      };
    });
    
    console.log('Connection state after wait:', connectionState);
    
    // Try to establish connection if not connected
    if (!connectionState.hubConnected) {
      console.log('Attempting to establish connection...');
      await page.evaluate(() => {
        //@ts-ignore
        if (window.comms && window.comms.connect) {
          //@ts-ignore
          window.comms.connect();
        }
      });
      
      // Wait for connection
      await page.waitForTimeout(5000);
      
      const retryConnectionState = await page.evaluate(() => {
        return {
          //@ts-ignore
          hubConnected: window.comms?.hub?.connected,
          //@ts-ignore
          peersCount: window.comms?.peers?.size || 0
        };
      });
      
      console.log('Connection state after retry:', retryConnectionState);
    }
    
    // Create and upload a test file
    const uploadResult = await page.evaluate(async () => {
      try {
        // Create a test file
        const fileSize = 1024 * 1024; // 1MB file
        const testFileData = new Uint8Array(fileSize);
        for (let i = 0; i < fileSize; i++) {
          testFileData[i] = i % 256;
        }
        
        const testFile = new File([testFileData], 'webrtc-test.bin', { type: 'application/octet-stream' });
        
        // Process the file (this should trigger WebRTC upload)
        //@ts-ignore
        await window.filer.importFile(testFile);
        
        // Check the results
        //@ts-ignore
        const fileCount = window.filer.db.files.size;
        //@ts-ignore
        const files = Array.from(window.filer.db.files.values());
        
        return {
          success: true,
          originalFileSize: fileSize,
          dbFileCount: fileCount,
          dbFiles: files,
          //@ts-ignore
          connectionState: {
            //@ts-ignore
            hubConnected: window.comms?.hub?.connected,
            //@ts-ignore
            peersCount: window.comms?.peers?.size || 0
          }
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message,
          //@ts-ignore
          connectionState: {
            //@ts-ignore
            hubConnected: window.comms?.hub?.connected,
            //@ts-ignore
            peersCount: window.comms?.peers?.size || 0
          }
        };
      }
    });
    
    console.log('Upload result:', uploadResult);
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: 'test-results/webrtc-upload-test.png',
      fullPage: true 
    });
    
    // Check if upload was successful
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.dbFileCount).toBe(1);
    
    console.log('=== WEBRTC UPLOAD TEST COMPLETED ===');
  });

  test('debug WebRTC connection issues', async ({ page }) => {
    console.log('=== WEBRTC CONNECTION DEBUG TEST ===');
    
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.text().includes('WebRTC') || msg.text().includes('connection')) {
        console.log(`Browser console [${msg.type()}]:`, msg.text());
      }
    });
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db;
    }, { timeout: 15000 });
    
    // Debug connection state over time
    for (let i = 0; i < 10; i++) {
      const debugInfo = await page.evaluate(() => {
        return {
          timestamp: Date.now(),
          //@ts-ignore
          commsExists: !!window.comms,
          //@ts-ignore
          hubExists: !!window.comms?.hub,
          //@ts-ignore
          hubConnected: window.comms?.hub?.connected,
          //@ts-ignore
          hubReadyState: window.comms?.hub?.readyState,
          //@ts-ignore
          hubUrl: window.comms?.hub?.url,
          //@ts-ignore
          peersCount: window.comms?.peers?.size || 0,
          //@ts-ignore
          peersArray: window.comms?.peers ? Array.from(window.comms.peers.keys()) : []
        };
      });
      
      console.log(`Debug info ${i + 1}/10:`, debugInfo);
      await page.waitForTimeout(1000);
    }
    
    await page.screenshot({ 
      path: 'test-results/webrtc-debug.png',
      fullPage: true 
    });
  });
});
