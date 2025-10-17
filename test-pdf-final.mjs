// Test with real PDF logic
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function extractPdfText(buffer) {
  try {
    // Convert Buffer to Uint8Array (required by pdf-parse)
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse(uint8Array);
    const text = await parser.getText();
    return text;
  } catch (error) {
    console.error('❌ Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

async function test() {
  try {
    // Test with text file first
    const buffer = fs.readFileSync('./test-document.txt');
    console.log('Testing with buffer size:', buffer.length);
    
    const text = await extractPdfText(buffer);
    console.log('✅ Success!');
    console.log('Text length:', text.length);
    console.log('First 200 chars:', text.substring(0, 200));
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

test();
