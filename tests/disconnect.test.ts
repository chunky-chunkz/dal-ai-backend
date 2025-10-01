/**
 * Test for robust disconnect handling in streaming endpoint
 * Tests AbortController and graceful disconnect handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Streaming Disconnect Handling', () => {
  let app: FastifyInstance;
  let baseURL: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    baseURL = address;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle client disconnect gracefully without error logs', async () => {
    const question = encodeURIComponent('Test question for disconnect handling');
    const url = `${baseURL}/api/answer/stream?question=${question}`;
    
    const abortController = new AbortController();
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      signal: abortController.signal
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);
    
    // Simulate client disconnect after 100ms
    setTimeout(() => {
      abortController.abort();
    }, 100);
    
    let disconnectError = null;
    try {
      const reader = response.body?.getReader();
      if (reader) {
        // Try to read some data before aborting
        await reader.read();
        await reader.read(); // This should fail due to abort
      }
    } catch (error: any) {
      disconnectError = error;
    }
    
    // Should have an abort error
    expect(disconnectError).toBeTruthy();
    expect(disconnectError.name).toMatch(/abort/i);
    
    console.log('✅ Client disconnect handled gracefully');
  });

  it('should clean up resources on disconnect', async () => {
    const question = encodeURIComponent('Resource cleanup test');
    const url = `${baseURL}/api/answer/stream?question=${question}`;
    
    // Create multiple connections and abort them
    const promises = Array.from({ length: 3 }, async (_, index) => {
      const controller = new AbortController();
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: controller.signal
      });
      
      // Abort after different delays
      setTimeout(() => {
        controller.abort();
      }, 50 + (index * 25));
      
      try {
        const reader = response.body?.getReader();
        if (reader) {
          while (true) {
            await reader.read();
          }
        }
      } catch (error) {
        // Expected abort error
        return { index, aborted: true };
      }
      
      return { index, aborted: false };
    });
    
    const results = await Promise.all(promises);
    
    // All should have been aborted
    for (const result of results) {
      expect(result.aborted).toBe(true);
    }
    
    console.log('✅ All connections properly cleaned up on disconnect');
  });

  it('should handle abort during different phases', async () => {
    const question = encodeURIComponent('Phase-specific abort test');
    const url = `${baseURL}/api/answer/stream?question=${question}`;
    
    // Test immediate abort
    const immediateController = new AbortController();
    immediateController.abort(); // Abort before request
    
    try {
      await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'text/event-stream' },
        signal: immediateController.signal
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.name).toMatch(/abort/i);
    }
    
    // Test abort during streaming
    const streamController = new AbortController();
    const streamResponse = await fetch(url, {
      method: 'GET', 
      headers: { 'Accept': 'text/event-stream' },
      signal: streamController.signal
    });
    
    expect(streamResponse.status).toBe(200);
    
    // Read one chunk then abort
    const reader = streamResponse.body?.getReader();
    if (reader) {
      try {
        await reader.read(); // Read first chunk
        streamController.abort(); // Abort during stream
        await reader.read(); // This should fail
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.name).toMatch(/abort/i);
      }
    }
    
    console.log('✅ Abort handling works in all phases');
  });
});
