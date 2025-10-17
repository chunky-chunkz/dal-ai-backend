// Test pdf-parse v1.x API
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('❌ Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

async function test() {
  try {
    const buffer = fs.readFileSync('./test-document.txt');
    console.log('Testing with buffer size:', buffer.length);
    console.log('pdfParse type:', typeof pdfParse);
    
    const text = await extractPdfText(buffer);
    console.log('\n✅ Success!');
    console.log('Text type:', typeof text);
    console.log('Text length:', text.length);
    console.log('First 200 chars:', text.substring(0, 200));
  } catch (e) {
    console.log('\n❌ Error:', e.message);
  }
}

test();
