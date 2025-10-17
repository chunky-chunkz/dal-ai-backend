// Test the documented API from pdf-parse v2.x
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function test() {
  try {
    // Read an actual text file for testing
    const buffer = fs.readFileSync('./test-document.txt');
    const uint8Array = new Uint8Array(buffer);
    
    console.log('Creating PDFParse instance...');
    const parser = new PDFParse(uint8Array);
    
    console.log('\nTrying direct getText with error handling...');
    const result = await parser.getText().catch(err => {
      console.log('getText failed:', err.message);
      return null;
    });
    
    console.log('Result type:', typeof result);
    console.log('Result value:', result);
    console.log('Is string:', typeof result === 'string');
    console.log('Length:', result?.length);
    
    // Check if there's a 'text' property on the result
    if (result && typeof result === 'object') {
      console.log('\nResult is object, keys:', Object.keys(result));
    }
    
  } catch (e) {
    console.log('Main error:', e.message);
    console.log('Stack:', e.stack);
  }
}

test();
