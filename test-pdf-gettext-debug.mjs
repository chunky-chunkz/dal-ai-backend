// Test getText return value
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function test() {
  try {
    // Create a minimal valid PDF
    const buffer = fs.readFileSync('./test-document.txt');
    const uint8Array = new Uint8Array(buffer);
    
    const parser = new PDFParse(uint8Array);
    console.log('Parser created');
    console.log('Parser methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
    
    // Try getText
    try {
      const text = await parser.getText();
      console.log('getText() returned:', typeof text);
      console.log('Value:', text);
    } catch (e) {
      console.log('getText() error:', e.message);
    }
    
    // Try load first, then getText
    try {
      console.log('\nTrying load() first...');
      await parser.load();
      const text = await parser.getText();
      console.log('After load, getText() returned:', typeof text);
      console.log('Value:', text);
    } catch (e) {
      console.log('load() error:', e.message);
    }
    
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
