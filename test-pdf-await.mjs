// Test PDFParse with await
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function testParse() {
  try {
    // Read a simple text file as test (not a real PDF)
    const buffer = fs.readFileSync('./test-document.txt');
    console.log('Buffer size:', buffer.length);
    
    const parser = new PDFParse(buffer);
    console.log('Parser created');
    
    // Check if parser is thenable
    console.log('Is thenable:', typeof parser.then === 'function');
    
    if (typeof parser.then === 'function') {
      const result = await parser;
      console.log('Result keys:', Object.keys(result));
      console.log('Has text:', 'text' in result);
    } else {
      console.log('Not a promise, checking methods...');
      console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

testParse();
