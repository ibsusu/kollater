import { test, expect } from '@playwright/test';

test.describe('Force Upload Test', () => {
  test('force upload directly via comms', async ({ page }) => {
    console.log('=== FORCE UPLOAD TEST ===');
    
    // Navigate to the client app
    await page.goto('/');
    await page.waitForSelector('.dropzone', { timeout: 10000 });
    await page.waitForTimeout(5000);
    
    // Wait for filer initialization
    await page.waitForFunction(() => {
      //@ts-ignore
      return window.filer && window.filer.db && window.comms;
    }, { timeout: 15000 });
    
    // Wait longer for WebRTC connection
    await page.waitForTimeout(10000);
    
    // Check connection state
    const connectionState = await page.evaluate(() => {
      return {
        //@ts-ignore
        simpleMode: window.filer?.simpleMode,
        //@ts-ignore
        hubConnected: window.comms?.hub?.connected,
        //@ts-ignore
        hubDestroyed: window.comms?.hub?.destroyed,
        //@ts-ignore
        peersCount: window.comms?.peers?.size || 0,
        //@ts-ignore
        hubExists: !!window.comms?.hub
      };
    });
    
    console.log('Connection state:', connectionState);
    
    // If connection is not established, wait more and retry
    if (!connectionState.hubConnected) {
      console.log('Waiting longer for WebRTC connection...');
      await page.waitForTimeout(15000);
      
      const retryState = await page.evaluate(() => {
        return {
          //@ts-ignore
          hubConnected: window.comms?.hub?.connected,
          //@ts-ignore
          hubDestroyed: window.comms?.hub?.destroyed,
          //@ts-ignore
          peersCount: window.comms?.peers?.size || 0
        };
      });
      console.log('Retry connection state:', retryState);
    }
    
    // Force upload directly via comms
    const uploadResult = await page.evaluate(async () => {
      try {
        // Create test data
        const testData = new Uint8Array(1024); // 1KB test data
        for (let i = 0; i < testData.length; i++) {
          testData[i] = i % 256;
        }
        
        // Create hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', testData);
        const hash = new Uint8Array(hashBuffer);
        
        console.log('=== FORCING UPLOAD ===');
        console.log('Test data size:', testData.length);
        console.log('Hash:', Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        // Check comms state
        //@ts-ignore
        const commsState = {
          //@ts-ignore
          hubExists: !!window.comms?.hub,
          //@ts-ignore
          hubConnected: window.comms?.hub?.connected,
          //@ts-ignore
          hubDestroyed: window.comms?.hub?.destroyed,
          //@ts-ignore
          peersCount: window.comms?.peers?.size || 0
        };
        console.log('Comms state before upload:', commsState);
        
        // Try to upload directly
        //@ts-ignore
        const uploadPromise = window.comms.upload(hash, testData);
        console.log('Upload promise created:', !!uploadPromise);
        
        // Wait for upload response
        const response = await uploadPromise;
        console.log('Upload response:', response);
        
        return {
          success: true,
          dataSize: testData.length,
          response: Array.from(response)
        };
      } catch (error: any) {
        console.error('Force upload error:', error);
        return { 
          success: false, 
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('Force upload result:', uploadResult);
    
    // Wait for any async operations to complete
    await page.waitForTimeout(5000);
    
    expect(uploadResult.success).toBe(true);
    
    console.log('=== FORCE UPLOAD TEST COMPLETED ===');
  });
});
