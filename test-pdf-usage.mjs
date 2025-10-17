// Test PDFParse usage
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

console.log('PDFParse type:', typeof PDFParse);
console.log('Is constructor:', PDFParse.prototype ? 'yes' : 'no');

// Try creating instance
try {
  const dummyBuffer = Buffer.from('test');
  const parser = new PDFParse(dummyBuffer);
  console.log('Instance created:', parser);
  console.log('Instance keys:', Object.keys(parser));
} catch (e) {
  console.log('Error creating instance:', e.message);
}
