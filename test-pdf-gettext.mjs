// Test PDFParse getText method
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

async function testGetText() {
  try {
    // Try with a text file (not PDF, but testing API)
    const buffer = fs.readFileSync('./test-document.txt');
    
    const parser = new PDFParse(buffer);
    console.log('Calling getText()...');
    
    const text = await parser.getText();
    console.log('Success! Text type:', typeof text);
    console.log('Text length:', text?.length);
    console.log('First 100 chars:', text?.substring(0, 100));
  } catch (e) {
    console.log('Error:', e.message);
    console.log('Stack:', e.stack);
  }
}

testGetText();
